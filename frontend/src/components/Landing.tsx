import { useEffect, useState } from "react";
import { Room } from "./Room";
import { Navbar } from "./Navbar";
import { motion } from "framer-motion";

export const Landing = () => {
    const [name, setName] = useState("");
    const [darkMode, setDarkMode] = useState(false);
    const [joined, setJoined] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
   
    const toggleDarkMode = () => {
        setDarkMode(prev => !prev);
    };

    const handleSystemDarkModeChange = (event: MediaQueryListEvent) => {
        setDarkMode(event.matches);
    };

    useEffect(() => {
        const systemDarkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setDarkMode(systemDarkModeQuery.matches);

        systemDarkModeQuery.addEventListener('change', handleSystemDarkModeChange);

        return () => {
            systemDarkModeQuery.removeEventListener('change', handleSystemDarkModeChange);
        };
    }, []);

    

    const buttonVariants = {
        hover: { scale: 1.1 },
        tap: { scale: 0.95 },
    };

    const pageVariants = {
        initial: { opacity: 0, y: 50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -50 },
    };

    if (!joined) {
        return (
            <motion.div
                className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-800'}`}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pageVariants}
                transition={{ duration: 0.5 }} 
            >
                <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} name={""} />
                <div className="flex flex-col items-center justify-center flex-grow">
                    <motion.input
                        type="text"
                        placeholder="Enter your name"
                        className={`w-80 px-4 py-2 border ${darkMode ? 'border-gray-700 text-white bg-gray-700' : 'border-gray-300 bg-white'} rounded-lg focus:outline-none`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        whileFocus={{ scale: 1.05 }} 
                    />
                    {errorMessage && <p className="text-red-500">{errorMessage}</p>}
                    
                    <motion.button
                        className={`mt-4 px-6 py-2 ${darkMode ? 'bg-blue-500' : 'bg-blue-600'} text-white rounded-lg hover:bg-blue-700 focus:outline-none flex items-center justify-center`}
                        onClick={() => {
                            if (name.trim() !== '') {
                                setJoined(true);
                                setErrorMessage("");
                            } else {
                                setErrorMessage('Please enter your name');
                            }
                        }}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap" 
                    >
                        Join
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </motion.button>
                </div>
            </motion.div>
        );
    }

    // Render Room component after joining
    return (
        <Room 
            name={name} 
            setJoined={setJoined} 
            darkMode={darkMode} 
            setDarkMode={setDarkMode} 
            toggleDarkMode={toggleDarkMode}
            
        />
    );
};
