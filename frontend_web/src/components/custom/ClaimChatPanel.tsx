import { useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Bot, Send, Loader2, X } from 'lucide-react';
import { ChatProvider } from '@/components/block/chat/chat-provider';
import { useChatContext } from '@/components/block/chat/hooks/use-chat-context';
import { useAddChat, useHasChat } from '@/components/block/chat/hooks/use-chats-state';
import {
  isErrorStateEvent,
  isMessageStateEvent,
  isStepStateEvent,
  isThinkingEvent,
} from '@/components/block/chat/types';
import { ChatMessageMemo } from '@/components/block/chat/chat-message';
import { ChatError } from '@/components/block/chat/chat-error';
import { StepEvent } from '@/components/block/chat/step-event';
import { ThinkingEvent } from '@/components/block/chat/thinking-event';
import { ChatProgress } from '@/components/block/chat/chat-progress';
import type { ScoredClaim } from '@/api/claims/api-requests';

const QUICK_PROMPTS = [
  'Explain the routing decision for this claim.',
  'What evidence gaps need to be resolved?',
  'Suggest next steps for this claim.',
  'Why did this rule fire?',
];

interface ClaimChatInnerProps {
  claim: ScoredClaim;
  onClose: () => void;
}

function buildClaimContext(claim: ScoredClaim): string {
  return (
    `[Context — Claim ${claim.claim_id}]\n` +
    `Fraud score: ${claim.fraud_score.toFixed(1)}% | ` +
    `Anomaly score: ${claim.anomaly_score.toFixed(3)} | ` +
    `Routing: ${claim.routing_decision} (${claim.rule_fired}) | ` +
    `Gaps: ${claim.gap_count} | Red flags: ${claim.red_flag_count} | ` +
    `Insured: ${claim.insured_id ?? 'N/A'} | ` +
    `Loss date: ${claim.loss_date ? claim.loss_date.split('T')[0] : 'N/A'} | ` +
    `Injury: ${claim.injury_flag} | ` +
    `Repair estimate: ${claim.repair_total_estimate != null ? `$${claim.repair_total_estimate.toLocaleString()}` : 'N/A'}\n\n`
  );
}

function ClaimChatInner({ claim, onClose }: ClaimChatInnerProps) {
  const {
    sendTextMessage,
    combinedEvents,
    progress,
    deleteProgress,
    isAgentRunning,
    isLoadingHistory,
  } = useChatContext();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = combinedEvents.length === 0 && !isLoadingHistory;

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combinedEvents]);

  const handleSend = (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isAgentRunning) return;
    setInput('');
    // Prepend claim context to the very first message so the agent always has it,
    // without auto-firing a request on mount.
    const payload = combinedEvents.length === 0 ? buildClaimContext(claim) + trimmed : trimmed;
    sendTextMessage(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isAgentRunning && input.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full max-h-[calc(100vh-8rem)] flex-col bg-gray-950 border border-blue-700 rounded-xl overflow-hidden shadow-2xl shadow-black/40 md:max-h-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-950/60 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold text-blue-100">
            Agent Chat — <span className="font-mono text-blue-300">{claim.claim_id}</span>
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0">
        {isLoadingHistory && <div className="text-xs text-gray-500 italic px-2">Loading…</div>}

        {/* Empty state — show quick-prompt chips */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-6 px-4">
            <p className="text-xs text-gray-500 text-center">
              Ask the agent anything about this claim. It can analyze scores, explain routing, and
              suggest next steps.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-blue-700 text-blue-300 hover:bg-blue-900/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {combinedEvents.map(m => {
          if (isErrorStateEvent(m)) return <ChatError key={m.value.id} {...m.value} />;
          if (isMessageStateEvent(m)) return <ChatMessageMemo key={m.value.id} {...m.value} />;
          if (isStepStateEvent(m)) return <StepEvent key={m.value.id} {...m.value} />;
          if (isThinkingEvent(m)) return <ThinkingEvent key={m.type} />;
          return null;
        })}
        <ChatProgress progress={progress || {}} deleteProgress={deleteProgress} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-900 px-3 py-2.5 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this claim…"
          rows={2}
          disabled={isAgentRunning}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-none outline-none focus:border-blue-600 transition-colors disabled:opacity-50"
          aria-label="Chat message input"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isAgentRunning}
          aria-label={isAgentRunning ? 'Agent is running' : 'Send message'}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
        >
          {isAgentRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

interface ClaimChatPanelProps {
  claim: ScoredClaim;
  onClose: () => void;
}

export function ClaimChatPanel({ claim, onClose }: ClaimChatPanelProps) {
  const addChat = useAddChat();
  const chatId = useRef(`claim-chat-${claim.claim_id}-${uuid()}`).current;
  const hasChat = useHasChat(chatId);

  // Register the chat in the Zustand store before rendering ChatProvider.
  useEffect(() => {
    addChat(chatId);
  }, [addChat, chatId]);

  if (!hasChat) {
    return (
      <div
        className="h-full rounded-xl border border-blue-700 bg-gray-950 px-4 py-6 text-center text-sm text-gray-400 shadow-2xl shadow-black/40"
        role="status"
      >
        Opening agent chat for claim{' '}
        <span className="font-mono text-blue-300">{claim.claim_id}</span>…
      </div>
    );
  }

  return (
    <ChatProvider chatId={chatId} isNewChat={true}>
      <ClaimChatInner claim={claim} onClose={onClose} />
    </ChatProvider>
  );
}
