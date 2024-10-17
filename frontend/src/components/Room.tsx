import { useEffect, useRef, useState } from "react";
import { Navbar } from "./Navbar";
import { IoSend } from "react-icons/io5";
import EmojiPicker from "emoji-picker-react";
import { motion } from "framer-motion";

export const Room = ({
  name,
  setJoined,
  darkMode,
  setDarkMode,
  toggleDarkMode,
}: {
  name: string;
  setJoined: React.Dispatch<React.SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleDarkMode: () => void;
}) => {
  const [lobby, setLobby] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [sendingPc, setSendingPc] = useState<RTCPeerConnection | null>(null);
  const [receivingPc, setReceivingPc] = useState<RTCPeerConnection | null>(
    null
  );
  const [remoteMediaStream, setRemoteMediaStream] =
    useState<MediaStream | null>(null);
  const [sendingDc, setSendingDc] = useState<RTCDataChannel | null>(null);
  const [receivingDc, setReceivingDc] = useState<RTCDataChannel | null>(null);
  const [chat, setChat] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<string[][]>([]);
  const [partnerName, setPartnerName] = useState<string>("");
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const onEmojiClick = (emojiData: { emoji: string }) => {
    setChat((prevChat) => prevChat + emojiData.emoji);
  };

  function handleLeave() {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setLobby(true);
    sendingPc?.close();
    setSendingPc(null);
    receivingPc?.close();
    setReceivingPc(null);
  }

  useEffect(() => {
    const socket = new WebSocket(
      "wss://ccme03ln92.execute-api.eu-north-1.amazonaws.com/production/"
    );

    function waitForAllICE(pc: RTCPeerConnection) {
      return new Promise((fufill, reject) => {
        pc.onicecandidate = (iceEvent: RTCPeerConnectionIceEvent) => {
          if (iceEvent.candidate === null) fufill("");
        };
        setTimeout(
          () => reject("Waited a long time for ice candidates..."),
          10000
        );
      });
    }

    // Function to handle messages
    const handleMessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);
      if (data.type === "send-offer") {
        const { roomId } = data;
        setLobby(false);
        const pc = new RTCPeerConnection();
        const dc = pc.createDataChannel("chat");

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => waitForAllICE(pc))
          .then(() =>
            socket.send(
              JSON.stringify({
                type: "offer",
                sdp: pc.localDescription,
                roomId: roomId,
              })
            )
          );

        setSendingDc(dc);
        setSendingPc(pc);
      } else if (data.type === "offer") {
        console.log("offer received");
        const { roomId, sdp: remoteSdp, partnerName } = data;
        setPartnerName(partnerName);
        setLobby(false);
        const pc = new RTCPeerConnection();

        const stream = new MediaStream();
        setRemoteMediaStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }

        pc.onicecandidate = (e) => {
          if (!e.candidate) {
            return;
          }
          if (e.candidate) {
            socket.send(
              JSON.stringify({
                type: "add-ice-candidate",
                candidate: e.candidate,
                recipientType: "receiver",
                roomId: roomId,
              })
            );
          }
        };
        const onReceiveMessage = (e: MessageEvent) => {
          setChatMessages((prevMessages) => [
            [partnerName, e.data],
            ...prevMessages,
          ]);
        };
        const onReceiveChannelStateChange = () => {
          setChatMessages([]);
        };

        pc.setRemoteDescription(remoteSdp).catch((error) =>
          console.log("error adding remote description on sender side", error)
        );

        pc.createAnswer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => waitForAllICE(pc))
          .then(() =>
            socket.send(
              JSON.stringify({
                type: "answer",
                roomId,
                sdp: pc.localDescription,
              })
            )
          );

        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dc.onmessage = onReceiveMessage;
          dc.onclose = onReceiveChannelStateChange;
          setReceivingDc(dc);
        };
        setReceivingPc(pc);
      } else if (data.type === "answer") {
        const { roomId, sdp: remoteSdp } = data;
        setLobby(false);
        setSendingPc((pc) => {
          pc?.setRemoteDescription(remoteSdp).catch((error) =>
            console.log("error adding remote description on sender side", error)
          );
          return pc;
        });
      } else if (data.type === "lobby") {
        setLobby(true);
      } else if (data.type === "add-ice-candidate") {
        const { candidate, recipientType } = data;
        if (recipientType == "sender") {
          setReceivingPc((pc) => {
            if (!pc) {
              console.error("receicng pc nout found");
            }
            console.log("adding ice to sender started");
            pc?.addIceCandidate(candidate);
            console.log("adding ice to sender completed");
            return pc;
          });
        } else {
          setSendingPc((pc) => {
            if (!pc) {
              console.error("sending pc nout found");
            }
            console.log(
              "adding ice to receiver started",
              pc?.remoteDescription
            );
            pc?.addIceCandidate(candidate);
            console.log("adding ice to receiver completed");
            return pc;
          });
        }
      } else if (data.type === "leave") {
        handleLeave();
      }
    };

    // Listening for messages
    socket.addEventListener("message", handleMessage);

    // Send the initial message after the WebSocket connection is established
    socket.addEventListener("open", async () => {
      socket.send(JSON.stringify({ type: "initiate", name }));
    });

    setSocket(socket);

    return () => {
      // Clean up the event listener when component unmounts
      socket.removeEventListener("message", handleMessage);
      socket.close(); // Close the WebSocket connection
    };
  }, [name]);

  // Handle WebRTC offer/answer/ICE Candidate exchange
  async function handleReceiveOffer(offer: RTCSessionDescriptionInit) {
    const peerConnection = createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket?.send(JSON.stringify({ type: "answer", answer }));
  }

  async function handleReceiveAnswer(answer: RTCSessionDescriptionInit) {
    if (sendingPc) {
      await sendingPc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  function handleNewICECandidateMessage(candidate: RTCIceCandidateInit) {
    const newCandidate = new RTCIceCandidate(candidate);
    sendingPc?.addIceCandidate(newCandidate);
  }

  // Create a new RTCPeerConnection
  function createPeerConnection() {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.send(
          JSON.stringify({ type: "ice-candidate", candidate: event.candidate })
        );
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        setRemoteMediaStream(event.streams[0]);
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play();
      }
    };

    return peerConnection;
  }

  const buttonVariants = {
    hover: { scale: 1.1 },
    tap: { scale: 0.9 },
  };

  return (
    <div
    className={`flex flex-col h-screen ${
      darkMode ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-800"
    } p-4`}
  >
    <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} name={name} />
    <div className={`flex-grow flex flex-col items-center justify-center`}>
      <div className="flex w-full justify-center">
        <div className="flex flex-col items-center w-full">
          {!lobby && (
            <div className="w-full text-center mb-2">
              You are now chatting with {partnerName}
            </div>
          )}
  
          {/* New message indicating that a partner is being found */}
          {lobby && (
            <div className="w-full text-center mb-2 text-gray-500">
              Finding new partner...
            </div>
          )}
  
          <div
            className={`w-full md:w-1/2 ${
              darkMode ? "bg-gray-700" : "bg-gray-100"
            } p-4 rounded-lg shadow-md flex flex-col h-full`}
          >
            <div
              className={`flex-grow  overflow-y-auto scrollbar-hide scroll-smooth flex flex-col-reverse`}
              style={{ maxHeight: 'calc(100vh - 200px)' }} 
            >
              {chatMessages.map((message, index) => (
                <motion.div
                  key={index}
                  className={`flex mb-4 ${
                    message[0] === "You" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`flex flex-col ${
                      message[0] === "You"
                        ? "ml-auto items-end"
                        : "mr-auto items-start"
                    }`}
                  >
                    <div
                      className={`${
                        message[0] === "You"
                          ? "bg-blue-500 text-white"
                          : darkMode
                          ? "bg-gray-500"
                          : "bg-[#FFFBF5]"
                      } rounded-md p-2 max-w-64 break-words`}
                    >
                      {message[1]}
                    </div>
                    <div className="text-xs">{message[0]}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
  
          <div className="mt-2 w-full md:w-1/2 relative">
            <motion.button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute left-2 top-2/4 transform -translate-y-2/4 text-gray-700 dark:text-white"
            >
              😀
            </motion.button>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-10 left-0 z-10"
              >
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </motion.div>
            )}
  
            <input
              value={chat}
              placeholder="Message"
              onChange={(e) => setChat(e.target.value)}
              type="text"
              className={`w-full px-10 py-2 pr-10 border ${
                darkMode
                  ? "border-gray-700 text-white bg-gray-700"
                  : "border-gray-300 bg-white text-black"
              } rounded-md focus:outline-none`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (chat.trim()) {
                    const newMessage = ["You", chat];
                    setChatMessages([newMessage, ...chatMessages]);
                    sendingDc?.send(chat);
                    setChat("");
                  }
                }
              }}
            />
            <motion.button
              variants={buttonVariants}
              onClick={() => {
                if (chat.trim()) {
                  const newMessage = ["You", chat];
                  setChatMessages([newMessage, ...chatMessages]);
                  sendingDc?.send(chat);
                  setChat("");
                }
              }}
              className="absolute right-2 top-2/4 transform -translate-y-2/4 text-2xl text-blue-500"
            >
              <IoSend />
            </motion.button>
          </div>
  
          <div className="flex mt-4 space-x-4">
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={() => {
                if (socket) {
                  handleLeave();
                  socket.send(JSON.stringify({ type: "leave" }));
                }
              }}
              className={`px-4 py-2 ${
                darkMode ? "bg-blue-500" : "bg-blue-600"
              } text-white rounded-md ${
                darkMode ? "hover:bg-blue-600" : "hover:bg-blue-700"
              }`}
            >
              Skip
            </motion.button>
  
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={() => {
                if (socket) {
                  handleLeave();
                  socket.send(JSON.stringify({ type: "disconnect" }));
                  setJoined(false);
                }
              }}
              className={`px-4 py-2 ${
                darkMode ? "bg-red-500" : "bg-red-600"
              } text-white rounded-md ${
                darkMode ? "hover:bg-red-600" : "hover:bg-red-700"
              }`}
            >
              Leave
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  );
};
