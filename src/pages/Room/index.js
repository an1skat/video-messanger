import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useWebRTC, { LOCAL_VIDEO } from "../../hooks/useWebRTC";

const Room = () => {
  const { id: roomID } = useParams();
  const { clients, provideMediaRef, cameraAvailable } = useWebRTC(roomID);
  const [cameraError, setCameraError] = useState(false); // Добавляем состояние для отслеживания ошибки доступа к камере

  useEffect(() => {
    setCameraError(!cameraAvailable); // Устанавливаем состояние ошибки, если камера недоступна
  }, [cameraAvailable]);

  console.log(clients);

  return (
    <div>
      {cameraError ? ( // Используем состояние ошибки вместо флага cameraAvailable
        <div style={{ backgroundColor: "black", color: "white" }}>
          Не удалось получить доступ к камере.
        </div>
      ) : (
        clients.map((clientID) => {
          return (
            <div key={clientID}>
              <video
                ref={(instance) => {
                  provideMediaRef(clientID, instance);
                }}
                autoPlay
                playsInline
                muted={clientID === LOCAL_VIDEO}
              />
            </div>
          );
        })
      )}
    </div>
  );
};
export default Room;
