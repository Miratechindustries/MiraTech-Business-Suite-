'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { 
  X, 
  Send, 
  MessageSquare, 
  AtSign, 
  Paperclip, 
  Clock, 
  User as UserIcon, 
  Tag, 
  CheckCircle2, 
  ExternalLink,
  CornerDownRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export interface EntityComment {
  id?: string;
  text: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar?: string;
  mentions: string[]; // array of userIds or names
  createdAt: any;
  attachments?: { name: string; url: string }[];
}

export interface TeamMember {
  id: string;
  displayName?: string;
  name?: string;
  email: string;
  role?: string;
  department?: string;
}

interface EntityActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  entityType: 'invoices' | 'purchase_orders' | 'projects' | 'tasks' | 'purchase_requests' | 'suppliers';
  entityId: string;
  entityTitle: string;
  entityRefCode?: string;
}

const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
  invoices: { label: 'Invoice', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  purchase_orders: { label: 'Purchase Order', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  projects: { label: 'Project', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  tasks: { label: 'Task', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  purchase_requests: { label: 'Purchase Request', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  suppliers: { label: 'Supplier', color: 'bg-slate-100 text-slate-800 border-slate-300' },
};

export default function EntityActivityDrawer({
  isOpen,
  onClose,
  companyId,
  entityType,
  entityId,
  entityTitle,
  entityRefCode
}: EntityActivityDrawerProps) {
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<TeamMember[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Team Members for @mention autocomplete
  useEffect(() => {
    if (!companyId || !isOpen) return;

    let isMounted = true;
    const fetchTeam = async () => {
      try {
        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, where('companyId', '==', companyId));
        const snap = await getDocs(qUsers);
        
        const list: TeamMember[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          list.push({
            id: doc.id,
            displayName: d.displayName || d.name || d.email.split('@')[0],
            name: d.name || d.displayName,
            email: d.email,
            role: d.role,
            department: d.department
          });
        });

        // Also check default team members or employees if empty
        if (list.length === 0) {
          const empRef = collection(db, 'companies', companyId, 'employees');
          const empSnap = await getDocs(empRef);
          empSnap.forEach(doc => {
            const d = doc.data();
            list.push({
              id: doc.id,
              displayName: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email,
              email: d.email,
              role: d.designation || 'Staff',
              department: d.department
            });
          });
        }

        if (isMounted) {
          setTeamMembers(list);
        }
      } catch (err) {
        console.warn('[EntityActivityDrawer] Failed to fetch team members for mentions:', err);
      }
    };

    fetchTeam();
    return () => {
      isMounted = false;
    };
  }, [companyId, isOpen]);

  // Real-time comments listener
  useEffect(() => {
    if (!companyId || !entityType || !entityId || !isOpen) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const commentsRef = collection(
      db, 
      'companies', 
      companyId, 
      entityType, 
      entityId, 
      'comments'
    );
    const qComments = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      qComments,
      (snapshot) => {
        const list: EntityComment[] = [];
        snapshot.forEach((doc) => {
          list.push({
            id: doc.id,
            ...doc.data(),
          } as EntityComment);
        });
        setComments(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[EntityActivityDrawer] Snapshot error:', err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [companyId, entityType, entityId, isOpen]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Handle textarea text change & detect @mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const selStart = e.target.selectionStart;
    setCommentText(val);

    // Look backward from cursor to see if inside a mention token
    const textBeforeCursor = val.substring(0, selStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex >= textBeforeCursor.lastIndexOf(' ')) {
      const queryStr = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();
      setMentionQuery(queryStr);
      setMentionCursorPos(lastAtIndex);
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (member: TeamMember) => {
    if (mentionCursorPos === null || !textareaRef.current) return;
    
    const memberName = member.displayName || member.name || member.email.split('@')[0];
    const textBefore = commentText.substring(0, mentionCursorPos);
    const textAfter = commentText.substring(textareaRef.current.selectionStart);
    
    const newText = `${textBefore}@${memberName} ${textAfter}`;
    setCommentText(newText);
    setShowMentionMenu(false);

    if (!selectedMentions.some(m => m.id === member.id)) {
      setSelectedMentions(prev => [...prev, member]);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursor = mentionCursorPos + memberName.length + 2;
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 50);
  };

  const handleAddAttachment = () => {
    if (!attachmentUrl.trim()) return;
    const name = attachmentUrl.split('/').pop() || 'Attachment Document';
    setAttachments(prev => [...prev, { name, url: attachmentUrl.trim() }]);
    setAttachmentUrl('');
    setShowAttachmentInput(false);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting || !companyId || !entityId) return;

    setSubmitting(true);
    const currentUser = auth.currentUser;
    const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Contributor';
    const authorEmail = currentUser?.email || 'user@miratechsuite.com';
    const authorId = currentUser?.uid || 'system_user';

    // Extract all mentions from text
    const extractedMentionUids: string[] = [];
    selectedMentions.forEach(m => {
      if (commentText.includes(`@${m.displayName}`) || commentText.includes(`@${m.name}`) || commentText.includes(`@${m.email.split('@')[0]}`)) {
        extractedMentionUids.push(m.id);
      }
    });

    try {
      const commentsRef = collection(
        db, 
        'companies', 
        companyId, 
        entityType, 
        entityId, 
        'comments'
      );

      const newComment: Partial<EntityComment> = {
        text: commentText.trim(),
        authorId,
        authorName,
        authorEmail,
        mentions: extractedMentionUids,
        createdAt: serverTimestamp(),
        attachments: attachments.length > 0 ? attachments : []
      };

      await addDoc(commentsRef, newComment);

      // Dispatch Notifications to Mentioned Team Members
      for (const targetUid of extractedMentionUids) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: targetUid,
            companyId,
            title: `Mentioned in ${ENTITY_LABELS[entityType]?.label || entityType} #${entityRefCode || entityId}`,
            message: `${authorName} mentioned you: "${commentText.trim().slice(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
            type: 'MENTION',
            link: `?tab=${entityType === 'invoices' ? 'invoices' : entityType === 'purchase_orders' ? 'procurement' : 'projects'}&id=${entityId}`,
            entityType,
            entityId,
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('[EntityActivityDrawer] Notification dispatch error:', notifErr);
        }
      }

      // Record statutory audit event in immutable audit trail
      try {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'ENTITY_COLLABORATION_NOTE',
          entityType,
          entityId,
          entityRefCode: entityRefCode || null,
          companyId,
          actorId: authorId,
          actorEmail: authorEmail,
          actorName: authorName,
          mentionsCount: extractedMentionUids.length,
          summary: `Added contextual note on ${ENTITY_LABELS[entityType]?.label || entityType} ${entityRefCode || entityId}`,
          timestamp: new Date().toISOString()
        });
      } catch (auditErr) {
        console.warn('[EntityActivityDrawer] Audit log write:', auditErr);
      }

      setCommentText('');
      setAttachments([]);
      setSelectedMentions([]);
      setSuccessToast('Comment posted and team notified');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error('[EntityActivityDrawer] Error posting comment:', err);
      alert(`Failed to post comment: ${err.message || 'Permission or network issue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = teamMembers.filter(m => {
    const name = (m.displayName || m.name || m.email).toLowerCase();
    return name.includes(mentionQuery);
  });

  if (!isOpen) return null;

  const entityMeta = ENTITY_LABELS[entityType] || { label: 'Record', color: 'bg-slate-100 text-slate-800 border-slate-300' };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${entityMeta.color}`}>
                  {entityMeta.label}
                </span>
                {entityRefCode && (
                  <span className="text-xs font-mono font-medium text-slate-600 bg-slate-200/80 px-1.5 py-0.2 rounded">
                    {entityRefCode}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-semibold text-slate-900 truncate mt-0.5" title={entityTitle}>
                {entityTitle || 'Activity & Collaboration'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2 text-xs font-medium text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Comments Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading activity thread...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-white/60">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-700">No notes or discussions yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Tag colleagues with <code className="bg-slate-100 text-indigo-600 px-1 rounded font-mono">@name</code> to collaborate directly on this {entityMeta.label.toLowerCase()}.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              let formattedDate = 'Just now';
              if (comment.createdAt) {
                if (comment.createdAt.toDate) {
                  formattedDate = comment.createdAt.toDate().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } else if (typeof comment.createdAt === 'string') {
                  formattedDate = new Date(comment.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }
              }

              const isCurrentUser = comment.authorEmail === auth.currentUser?.email;

              return (
                <div
                  key={comment.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs ${
                    isCurrentUser 
                      ? 'bg-indigo-50/60 border-indigo-200/80 ml-4' 
                      : 'bg-white border-slate-200 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${
                        isCurrentUser ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}>
                        {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="font-semibold text-slate-800 truncate">
                        {comment.authorName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 font-mono">
                      <Clock className="w-3 h-3" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Comment Text with Highlighted Mentions */}
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {comment.text.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, idx) => {
                      if (part.startsWith('@')) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center font-semibold text-indigo-700 bg-indigo-100/90 px-1 py-0.2 rounded mx-0.5"
                          >
                            {part}
                          </span>
                        );
                      }
                      return part;
                    })}
                  </div>

                  {/* Attachments */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                      {comment.attachments.map((att, attIdx) => (
                        <a
                          key={attIdx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-indigo-600 transition-colors text-[11px]"
                        >
                          <Paperclip className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[140px]">{att.name}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Mention Suggestions Popover */}
        {showMentionMenu && filteredMembers.length > 0 && (
          <div className="absolute bottom-[160px] left-4 right-4 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-20 divide-y divide-slate-100">
            <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <AtSign className="w-3 h-3" />
              <span>Mention Team Member</span>
            </div>
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMention(member)}
                className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50/70 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                    {(member.displayName || member.name || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-indigo-700">
                      {member.displayName || member.name || member.email.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">{member.email}</p>
                  </div>
                </div>
                {member.role && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {member.role}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Input & Form Area */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <form onSubmit={handlePostComment} className="space-y-2">
            
            {/* Active Attachments list */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {attachments.map((att, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700">
                    <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="text-slate-400 hover:text-red-600 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Optional Attachment Link Field */}
            {showAttachmentInput && (
              <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-medium hover:bg-indigo-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttachmentInput(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Comment Textarea */}
            <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-slate-50/50">
              <textarea
                ref={textareaRef}
                rows={2}
                value={commentText}
                onChange={handleTextChange}
                placeholder={`Write a note... Type @ to tag a team member.`}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent resize-none focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handlePostComment(e);
                  }
                }}
              />

              <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-200/60 bg-white rounded-b-xl">
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setCommentText(prev => prev + '@');
                      setMentionQuery('');
                      setShowMentionMenu(true);
                      textareaRef.current?.focus();
                    }}
                    className="p-1 rounded hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    title="Mention a colleague (@)"
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                    className="p-1 rounded hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    title="Attach reference link"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono ml-1 hidden sm:inline">
                    ⌘+Enter to post
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!commentText.trim() || submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
                >
                  {submitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Post</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
