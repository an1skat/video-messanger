import { useCallback, useEffect, useRef, useState } from "react";
import useStateWithCallback from "./useStateWithCallback";
import freeice from "freeice";
import socket from "../socket";
import ACTIONS from "../socket/actions";

export const LOCAL_VIDEO = "LOCAL_VIDEO";

export default function useWebRTC(roomID) {
  const [clients, updateClients] = useStateWithCallback([]);
  const [cameraAvailable, setCameraAvailable] = useState(true); // Добавляем состояние для отслеживания доступности камеры

  const addNewClient = useCallback(
    (newClient, cb) => {
      if (!clients.includes(newClient)) {
        updateClients((list) => [...list, newClient], cb);
      }
    },
    [clients, updateClients],
  );

  const peerConnections = useRef({});
  const localMediaStream = useRef(null);
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null,
  });

  useEffect(() => {
    async function handleNewPeer({ peerID, createOffer }) {
      if (peerID in peerConnections.current) {
        return console.warn(`Already connected to peer ${peerID}`);
      }

      // Проверяем, существует ли уже соединение для данного peerID
      if (!peerConnections.current[peerID]) {
        peerConnections.current[peerID] = new RTCPeerConnection({
          iceServers: freeice(),
        });

        peerConnections.current[peerID].onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit(ACTIONS.RELAY_ICE, {
              peerID,
              iceCandidate: event.candidate,
            });
          }
        };

        let tracksNumber = 0;
        peerConnections.current[peerID].ontrack = ({
          streams: [remoteStream],
        }) => {
          tracksNumber++;

          if (tracksNumber >= 1) {
            // wait a video and audio
            addNewClient(peerID, () => {
              // Проверяем, что localMediaStream.current не равен null перед использованием
              if (localMediaStream.current) {
                peerMediaElements.current[peerID].srcObject = remoteStream;
              }
            });
          }
        };

        // Проверяем, что localMediaStream.current не равен null перед использованием
        if (localMediaStream.current) {
          localMediaStream.current.getTracks().forEach((track) => {
            peerConnections.current[peerID].addTrack(
              track,
              localMediaStream.current,
            );
          });
        }

        if (createOffer) {
          const offer = await peerConnections.current[peerID].createOffer();

          await peerConnections.current[peerID].setLocalDescription(offer);

          socket.emit(ACTIONS.RELAY_SDP, {
            peerID,
            sessionDescription: offer,
          });
        }
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);
  }, []);

  useEffect(() => {
    async function setRemoteMedia({
      peerID,
      sessionDescription: remoteDescription,
    }) {
      await peerConnections.current[peerID].setRemoteDescription(
        new RTCSessionDescription(remoteDescription),
      );

      if (remoteDescription.type === "offer") {
        const answer = await peerConnections.current[peerID].createAnswer();

        await peerConnections.current[peerID].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        });
      }
    }
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);
  }, []);

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerID, iceCandidate }) => {
      peerConnections.current[peerID].addIceCandidate(
        new RTCIceCandidate(iceCandidate),
      );
    });
  }, []);

  useEffect(() => {
    const handleRemovePeer = ({ peerID }) => {
      if (peerConnections.current[peerID]) {
        peerConnections.current[peerID].close();
      }

      delete peerConnections.current[peerID];
      delete peerMediaElements.current[peerID];

      updateClients((list) => list.filter((c) => c !== peerID));
    };

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);
  }, []);

  useEffect(() => {
    async function startCapture() {
      try {
        localMediaStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: 1600,
            height: 900,
          },
        });

        addNewClient(LOCAL_VIDEO, () => {
          const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

          if (localVideoElement) {
            localVideoElement.volume = 0;
            localVideoElement.srcObject = localMediaStream.current;
          }
        });
      } catch (error) {
        console.error("Error getting userMedia:", error);
        setCameraAvailable(false); // Устанавливаем флаг, если не удалось получить доступ к камере
      }
    }

    startCapture()
      .then(() => socket.emit(ACTIONS.JOIN, { room: roomID }))
      .catch((e) => console.error("Error getting userMedia:", e));

    return () => {
      if (localMediaStream.current) {
        // Добавляем проверку на null
        localMediaStream.current.getTracks().forEach((track) => track.stop());
      }

      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomID]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return {
    clients,
    provideMediaRef,
    cameraAvailable,
  };
}
