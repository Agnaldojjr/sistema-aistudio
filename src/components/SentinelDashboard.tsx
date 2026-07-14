import React, { useEffect, useState, useRef } from 'react';
import { Shield, RefreshCw, Send, Bot, User, Play, FileBarChart, HardDrive } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export default function SentinelDashboard() {
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = localStorage.getItem('agnaldo_hermes_chat');
    return cached ? JSON.parse(cached) : [
      { 
        sender: 'agent', 
        text: 'Olá, Dr. Agnaldo! Sou o Hermes, o Agente Copiloto IA do seu consultório. Estou rodando na sua VPS Oracle, integrado ao seu banco de dados CRM e à sua conta de WhatsApp. Como posso ajudar com os seus atendimentos particulares, relatórios de faturamento ou testes automatizados do site hoje?', 
        timestamp: new Date().toISOString() 
      }
    ];
  });
  const [inputVal, setInputVal] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('agnaldo_hermes_chat', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || sendingMsg) return;

    const userText = textToSend.trim();
    setInputVal('');
    
    // Add user message locally
    const newMsg: ChatMessage = { sender: 'user', text: userText, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, newMsg]);
    setSendingMsg(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: messages })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { 
        sender: 'agent', 
        text: data.reply || 'Erro na resposta do copiloto.', 
        timestamp: new Date().toISOString() 
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        sender: 'agent', 
        text: 'Erro de comunicação. Certifique-se de que a VPS Oracle está online e o servidor Express ou funções do Vercel estão configurados corretamente.', 
        timestamp: new Date().toISOString() 
      }]);
    } finally {
      setSendingMsg(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Deseja redefinir o histórico de conversas com o Hermes?")) {
      setMessages([
        { 
          sender: 'agent', 
          text: 'Olá, Dr. Agnaldo! Histórico redefinido. Sou o Hermes, seu Copiloto IA. Como posso ajudar?', 
          timestamp: new Date().toISOString() 
        }
      ]);
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#FAF8F5] text-zinc-800 p-4 sm:p-6 font-sans flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C09553]/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#8B0000] text-white rounded-xl shadow-lg">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#8B0000]">Copiloto IA Hermes</h1>
              <p className="text-xs text-zinc-500">Conectado na VPS Oracle • Análise Financeira, Auditoria de Agenda e Testes E2E</p>
            </div>
          </div>

          <button 
            onClick={clearChat}
            className="p-2 bg-white border border-zinc-200 text-zinc-500 rounded-lg hover:border-zinc-300 hover:text-zinc-700 transition-all text-xs font-bold shadow-xs cursor-pointer"
          >
            Limpar Conversa
          </button>
        </div>

        {/* Quick Action Commands */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={() => handleSendMessage("Hermes, execute a varredura completa das abas do site no Vercel agora e corrija eventuais erros.")}
            disabled={sendingMsg}
            className="p-3 bg-white border border-zinc-200 hover:border-[#8B0000] rounded-xl text-left hover:shadow-sm transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 fill-emerald-600" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-800">Testar abas do Site</p>
              <p className="text-[10px] text-zinc-400 truncate">Busca e corrige bugs via Vercel</p>
            </div>
          </button>

          <button
            onClick={() => handleSendMessage("Hermes, gere um Relatório Executivo de Saúde da Clínica com insights financeiros e de agenda hoje.")}
            disabled={sendingMsg}
            className="p-3 bg-white border border-zinc-200 hover:border-[#8B0000] rounded-xl text-left hover:shadow-sm transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileBarChart className="w-4 h-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-800">Relatório Semanal</p>
              <p className="text-[10px] text-zinc-400 truncate">Faturamento e consultas pendentes</p>
            </div>
          </button>

          <button
            onClick={() => handleSendMessage("Hermes, qual o status de uso de recursos e processos da VPS Oracle agora?")}
            disabled={sendingMsg}
            className="p-3 bg-white border border-zinc-200 hover:border-[#8B0000] rounded-xl text-left hover:shadow-sm transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-50 text-zinc-600 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-800">Status da VPS Oracle</p>
              <p className="text-[10px] text-zinc-400 truncate">Uso de RAM, CPU e processos do bot</p>
            </div>
          </button>
        </div>

        {/* Chat Conversation Panel */}
        <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-xs flex flex-col flex-1 h-[55vh] overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FAF8F5]/30">
            {messages.map((msg, index) => {
              const isAgent = msg.sender === 'agent';
              return (
                <div key={index} className={`flex items-start gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div className={`p-2 rounded-xl flex-shrink-0 ${isAgent ? 'bg-[#8B0000] text-white' : 'bg-[#C09553] text-[#FAF8F5]'}`}>
                    {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  {/* Message Bubble */}
                  <div className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs text-xs leading-relaxed ${isAgent ? 'bg-white text-zinc-700 border border-zinc-150' : 'bg-[#8B0000] text-white'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span className="block text-[8px] mt-1.5 opacity-65 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {sendingMsg && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#8B0000] text-white flex-shrink-0">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="bg-white border border-zinc-150 rounded-2xl p-3.5 shadow-xs text-xs text-zinc-400 italic">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Hermes processando requisição na VPS...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputVal);
            }} 
            className="p-3 border-t border-zinc-200 bg-white flex gap-2"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Digite um comando para o Hermes (ex: 'Gerar orientações pós-extração')"
              className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] transition-all"
              disabled={sendingMsg}
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || sendingMsg}
              className="px-4 bg-[#8B0000] hover:bg-[#700000] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
