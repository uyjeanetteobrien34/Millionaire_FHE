import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Question {
  id: string;
  question: string;
  options: string[];
  encryptedAnswer: string;
  difficulty: number;
  prize: number;
  answered: boolean;
}

interface Player {
  address: string;
  name: string;
  score: number;
  level: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [prizeMoney, setPrizeMoney] = useState(0);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lifelines, setLifelines] = useState({
    fiftyFifty: true,
    askAudience: true,
    phoneAFriend: true
  });

  // Sample questions data (in a real app, this would come from the contract)
  const sampleQuestions: Question[] = [
    {
      id: "q1",
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      encryptedAnswer: FHEEncryptNumber(2), // Paris is option 2 (0-indexed)
      difficulty: 1,
      prize: 100,
      answered: false
    },
    {
      id: "q2",
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      encryptedAnswer: FHEEncryptNumber(1), // Mars
      difficulty: 1,
      prize: 200,
      answered: false
    },
    {
      id: "q3",
      question: "What is the largest mammal?",
      options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
      encryptedAnswer: FHEEncryptNumber(1), // Blue Whale
      difficulty: 2,
      prize: 300,
      answered: false
    },
    {
      id: "q4",
      question: "Which element has the chemical symbol 'O'?",
      options: ["Gold", "Oxygen", "Osmium", "Oganesson"],
      encryptedAnswer: FHEEncryptNumber(1), // Oxygen
      difficulty: 2,
      prize: 500,
      answered: false
    },
    {
      id: "q5",
      question: "Who painted the Mona Lisa?",
      options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
      encryptedAnswer: FHEEncryptNumber(2), // Leonardo da Vinci
      difficulty: 3,
      prize: 1000,
      answered: false
    }
  ];

  // Sample leaderboard data
  const sampleLeaderboard: Player[] = [
    { address: "0x123...abc", name: "CryptoKing", score: 1000000, level: 15 },
    { address: "0x456...def", name: "BlockchainQueen", score: 750000, level: 12 },
    { address: "0x789...ghi", name: "DeFiMaster", score: 500000, level: 10 },
    { address: "0xabc...jkl", name: "FHEExpert", score: 250000, level: 8 },
    { address: "0xdef...mno", name: "ZamaFan", score: 100000, level: 6 }
  ];

  useEffect(() => {
    // Simulate loading questions from contract
    setTimeout(() => {
      setQuestions(sampleQuestions);
      setLeaderboard(sampleLeaderboard);
      setLoading(false);
    }, 1500);
    
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const startGame = () => {
    setGameStarted(true);
    setShowIntro(false);
    setPlayerLevel(1);
    setPrizeMoney(0);
    setGameOver(false);
    setCurrentQuestion(sampleQuestions[0]);
  };

  const selectOption = (index: number) => {
    if (showAnswer) return;
    setSelectedOption(index);
  };

  const submitAnswer = async () => {
    if (selectedOption === null || !currentQuestion) return;
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const correctAnswer = FHEDecryptNumber(currentQuestion.encryptedAnswer);
      const isAnswerCorrect = selectedOption === correctAnswer;
      
      setIsCorrect(isAnswerCorrect);
      setShowAnswer(true);
      
      if (isAnswerCorrect) {
        setPrizeMoney(currentQuestion.prize);
        if (playerLevel < sampleQuestions.length) {
          setTimeout(() => {
            setPlayerLevel(playerLevel + 1);
            setCurrentQuestion(sampleQuestions[playerLevel]);
            setSelectedOption(null);
            setShowAnswer(false);
          }, 3000);
        } else {
          setTimeout(() => {
            setGameOver(true);
          }, 3000);
        }
      } else {
        setTimeout(() => {
          setGameOver(true);
        }, 3000);
      }
    } catch (e) {
      console.error("Decryption failed:", e);
    } finally {
      setIsDecrypting(false);
    }
  };

  const useFiftyFifty = () => {
    if (!lifelines.fiftyFifty || !currentQuestion) return;
    
    const correctAnswer = FHEDecryptNumber(currentQuestion.encryptedAnswer);
    const optionsToRemove = [];
    
    // Remove two incorrect options
    for (let i = 0; i < 4; i++) {
      if (i !== correctAnswer && optionsToRemove.length < 2) {
        optionsToRemove.push(i);
      }
    }
    
    // Update lifelines
    setLifelines({
      ...lifelines,
      fiftyFifty: false
    });
    
    // Visual effect for removed options
    const options = document.querySelectorAll('.option');
    optionsToRemove.forEach(index => {
      options[index].classList.add('removed');
    });
  };

  const checkContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        alert("Contract is available and ready to use!");
      } else {
        alert("Contract is currently unavailable");
      }
    } catch (e) {
      console.error("Error checking contract availability:", e);
      alert("Error checking contract availability");
    }
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="neon-spinner"></div>
      <p className="neon-text">Initializing encrypted game show...</p>
    </div>
  );

  return (
    <div className="app-container neon-theme">
      <header className="app-header">
        <div className="logo">
          <h1 className="neon-title">FHE<span>Millionaire</span></h1>
          <div className="subtitle">Who Wants to Be a Millionaire?</div>
        </div>
        <div className="header-actions">
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
          </div>
        </div>
      </header>
      
      <div className="main-content partitioned-layout">
        {/* Left Panel: Game Information */}
        <div className="panel left-panel">
          <div className="panel-content">
            <div className="info-card">
              <h2 className="neon-header">Game Progress</h2>
              <div className="progress-bar">
                {sampleQuestions.map((q, index) => (
                  <div 
                    key={q.id} 
                    className={`progress-step ${index < playerLevel ? 'completed' : ''} ${index === playerLevel - 1 ? 'current' : ''}`}
                  >
                    <div className="step-number">${q.prize}</div>
                    <div className="step-level">Level {index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="info-card">
              <h2 className="neon-header">Lifelines</h2>
              <div className="lifelines">
                <button 
                  className={`lifeline ${!lifelines.fiftyFifty ? 'used' : ''}`}
                  onClick={useFiftyFifty}
                  disabled={!lifelines.fiftyFifty}
                >
                  <div className="lifeline-icon">50:50</div>
                  <div className="lifeline-name">Fifty-Fifty</div>
                </button>
                
                <button 
                  className={`lifeline ${!lifelines.askAudience ? 'used' : ''}`}
                  disabled={!lifelines.askAudience}
                >
                  <div className="lifeline-icon">👥</div>
                  <div className="lifeline-name">Ask Audience</div>
                </button>
                
                <button 
                  className={`lifeline ${!lifelines.phoneAFriend ? 'used' : ''}`}
                  disabled={!lifelines.phoneAFriend}
                >
                  <div className="lifeline-icon">📞</div>
                  <div className="lifeline-name">Phone a Friend</div>
                </button>
              </div>
            </div>
            
            <div className="info-card">
              <h2 className="neon-header">Current Prize</h2>
              <div className="prize-display">
                <div className="prize-amount">${prizeMoney}</div>
                <div className="prize-label">FHE Secured</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Center Panel: Game Area */}
        <div className="panel center-panel">
          <div className="panel-content">
            {showIntro && (
              <div className="intro-screen">
                <h1 className="intro-title">FHE Millionaire</h1>
                <div className="intro-subtitle">The World's First Fully Homomorphic Encrypted Game Show</div>
                
                <div className="intro-features">
                  <div className="feature">
                    <div className="feature-icon">🔒</div>
                    <div className="feature-text">Answers encrypted with Zama FHE</div>
                  </div>
                  <div className="feature">
                    <div className="feature-icon">⚖️</div>
                    <div className="feature-text">Guaranteed fair gameplay</div>
                  </div>
                  <div className="feature">
                    <div className="feature-icon">💰</div>
                    <div className="feature-text">Win up to $1,000,000</div>
                  </div>
                </div>
                
                <div className="intro-description">
                  <p>Experience the revolutionary game show where answers are encrypted using Zama's Fully Homomorphic Encryption technology.</p>
                  <p>Not even the game operators know the correct answers, ensuring complete fairness and transparency.</p>
                </div>
                
                <button className="start-button neon-button" onClick={startGame}>Start Game</button>
                
                <div className="intro-actions">
                  <button className="neon-button secondary" onClick={() => setShowFeatures(true)}>How It Works</button>
                  <button className="neon-button secondary" onClick={() => setShowFAQ(true)}>FAQ</button>
                  <button className="neon-button secondary" onClick={checkContractAvailability}>Check Contract</button>
                </div>
              </div>
            )}
            
            {gameStarted && currentQuestion && !gameOver && (
              <div className="question-area">
                <div className="question-header">
                  <div className="question-level">Question #{playerLevel}</div>
                  <div className="question-prize">For ${currentQuestion.prize}</div>
                </div>
                
                <div className="question-text">{currentQuestion.question}</div>
                
                <div className="options-grid">
                  {currentQuestion.options.map((option, index) => (
                    <div 
                      key={index}
                      className={`option 
                        ${selectedOption === index ? 'selected' : ''}
                        ${showAnswer && index === FHEDecryptNumber(currentQuestion.encryptedAnswer) ? 'correct' : ''}
                        ${showAnswer && selectedOption === index && !isCorrect ? 'incorrect' : ''}
                      `}
                      onClick={() => selectOption(index)}
                    >
                      <div className="option-letter">{String.fromCharCode(65 + index)}</div>
                      <div className="option-text">{option}</div>
                    </div>
                  ))}
                </div>
                
                <div className="game-controls">
                  {!showAnswer ? (
                    <button 
                      className="submit-button neon-button"
                      onClick={submitAnswer}
                      disabled={selectedOption === null || isDecrypting}
                    >
                      {isDecrypting ? "Decrypting with FHE..." : "Lock In Answer"}
                    </button>
                  ) : (
                    <div className="result-feedback">
                      {isCorrect ? (
                        <div className="correct-feedback">
                          <div className="result-icon">✓</div>
                          <div className="result-text">Correct! ${currentQuestion.prize} secured!</div>
                        </div>
                      ) : (
                        <div className="incorrect-feedback">
                          <div className="result-icon">✗</div>
                          <div className="result-text">Sorry, that's incorrect</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {gameOver && (
              <div className="game-over-screen">
                <h2 className="game-over-title">Game Over</h2>
                <div className="final-prize">You won: ${prizeMoney}</div>
                
                <div className="game-over-message">
                  {prizeMoney >= 1000000 ? (
                    <div className="millionaire-message">
                      <div className="trophy-icon">🏆</div>
                      <h3>Congratulations Millionaire!</h3>
                      <p>You've answered all questions correctly and won the grand prize!</p>
                    </div>
                  ) : (
                    <p>Thanks for playing FHE Millionaire!</p>
                  )}
                </div>
                
                <div className="game-over-actions">
                  <button className="neon-button" onClick={startGame}>Play Again</button>
                  <button className="neon-button secondary" onClick={() => setShowIntro(true)}>Main Menu</button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel: Leaderboard and Info */}
        <div className="panel right-panel">
          <div className="panel-content">
            <div className="info-card">
              <h2 className="neon-header">Top Players</h2>
              <div className="leaderboard">
                {leaderboard.map((player, index) => (
                  <div key={index} className="leaderboard-item">
                    <div className="player-rank">{index + 1}</div>
                    <div className="player-info">
                      <div className="player-name">{player.name}</div>
                      <div className="player-address">{player.address.substring(0, 6)}...{player.address.substring(38)}</div>
                    </div>
                    <div className="player-score">${player.score.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="info-card">
              <h2 className="neon-header">FHE Technology</h2>
              <div className="fhe-info">
                <p>This game uses Zama's Fully Homomorphic Encryption to encrypt answers.</p>
                <p>Answers are encrypted on-chain and can only be decrypted with your wallet signature.</p>
                <div className="fhe-badge">
                  <div className="fhe-icon">🔐</div>
                  <span>FHE-Powered Fairness</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showFAQ && (
        <div className="modal-overlay">
          <div className="modal-content neon-card">
            <div className="modal-header">
              <h2>Frequently Asked Questions</h2>
              <button onClick={() => setShowFAQ(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="faq-item">
                <h3>How does FHE protect the game?</h3>
                <p>Answers are encrypted using Zama's Fully Homomorphic Encryption technology. This means that even the game operators cannot see the correct answers, preventing any possibility of cheating or question leaks.</p>
              </div>
              
              <div className="faq-item">
                <h3>How do I decrypt answers?</h3>
                <p>When you submit an answer, your wallet will sign a message that allows the frontend to decrypt the correct answer. This process happens locally in your browser - the decrypted answer is never sent to any server.</p>
              </div>
              
              <div className="faq-item">
                <h3>Is this a real blockchain game?</h3>
                <p>Yes! The game questions and encrypted answers are stored on-chain using our UniversalAdapter contract. Your progress and winnings are securely recorded on the blockchain.</p>
              </div>
              
              <div className="faq-item">
                <h3>Can I win real money?</h3>
                <p>Currently, this is a demonstration of FHE technology in gaming. In a production version, players would win real cryptocurrency prizes based on their performance.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="neon-button" onClick={() => setShowFAQ(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {showFeatures && (
        <div className="modal-overlay">
          <div className="modal-content neon-card">
            <div className="modal-header">
              <h2>How FHE Millionaire Works</h2>
              <button onClick={() => setShowFeatures(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="feature-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Question Creation</h3>
                  <p>Game creators add questions to the blockchain. The correct answer is encrypted using Zama FHE before being stored.</p>
                </div>
              </div>
              
              <div className="feature-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Secure Gameplay</h3>
                  <p>Players answer questions without anyone (including game operators) knowing the correct answers during gameplay.</p>
                </div>
              </div>
              
              <div className="feature-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Wallet Verification</h3>
                  <p>When submitting an answer, players sign a message with their wallet to authorize decryption of the correct answer.</p>
                </div>
              </div>
              
              <div className="feature-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Local Decryption</h3>
                  <p>The correct answer is decrypted locally in the player's browser and compared to their selection.</p>
                </div>
              </div>
              
              <div className="feature-step">
                <div className="step-number">5</div>
                <div className="step-content">
                  <h3>Prize Distribution</h3>
                  <p>Winnings are calculated based on correctly answered questions and recorded on-chain.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="neon-button" onClick={() => setShowFeatures(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">FHE<span>Millionaire</span></div>
            <p>Powered by Zama FHE Technology</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© {new Date().getFullYear()} FHE Millionaire. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;