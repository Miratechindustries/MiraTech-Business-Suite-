"use client";

import { useState, useEffect } from "react";
import { 
  Share2, 
  Calendar, 
  TrendingUp, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Globe, 
  BarChart3, 
  Users, 
  Eye, 
  Heart, 
  MessageSquare, 
  Repeat2, 
  X, 
  Loader2, 
  Sparkles,
  Check
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { motion } from "motion/react";
import { useUserStore, useToastStore } from "../lib/store";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  followers: number;
  status: "Connected" | "Syncing" | "Disconnected";
  avatarColor: string;
}

interface ScheduledPost {
  id: string;
  platform: string;
  content: string;
  scheduledTime: string;
  status: "scheduled" | "published" | "draft";
  campaign: string;
  metrics?: {
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    ctr?: string;
  };
}

const INITIAL_ACCOUNTS: SocialAccount[] = [
  { id: "1", platform: "Twitter / X", handle: "@miratech_io", followers: 14250, status: "Connected", avatarColor: "bg-slate-900 text-white" },
  { id: "2", platform: "LinkedIn", handle: "MiraTech Industries", followers: 28500, status: "Connected", avatarColor: "bg-blue-600 text-white" },
  { id: "3", platform: "Instagram", handle: "@miratech.official", followers: 9800, status: "Connected", avatarColor: "bg-pink-600 text-white" },
  { id: "4", platform: "Facebook", handle: "MiraTech Global Corp", followers: 12100, status: "Connected", avatarColor: "bg-indigo-600 text-white" },
];

const INITIAL_POSTS: ScheduledPost[] = [
  {
    id: "p1",
    platform: "LinkedIn",
    content: "We are thrilled to announce our Q3 Enterprise Cloud Migration update, featuring real-time double-entry ledgers and automated AI security audits. Read the whitepaper.",
    scheduledTime: "2026-08-15T10:00",
    status: "scheduled",
    campaign: "Q3 Enterprise Launch",
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, ctr: "0.0%" }
  },
  {
    id: "p2",
    platform: "Twitter / X",
    content: "Security and transparency are core to MiraTech. Our immutable SecOps audit trails ensure 100% cryptographic verification across all workspace nodes. 🔒 #SecOps #Cloud",
    scheduledTime: "2026-08-16T14:30",
    status: "scheduled",
    campaign: "Security Compliance",
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, ctr: "0.0%" }
  },
  {
    id: "p3",
    platform: "Instagram",
    content: "Behind the scenes at MiraTech HQ: Engineering Sprint 42 in full swing! Building polished financial and marketing hubs for global enterprise teams.",
    scheduledTime: "2026-08-18T09:15",
    status: "draft",
    campaign: "Brand Culture",
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, ctr: "0.0%" }
  },
  {
    id: "p4",
    platform: "Facebook",
    content: "MiraTech Q2 Financial Health Report is now live! Our consolidated revenue reached $2.84M with 98.5% risk mitigation index. Thank you to our incredible partners.",
    scheduledTime: "2026-08-10T12:00",
    status: "published",
    campaign: "Q2 Financial Review",
    metrics: { impressions: 24500, likes: 1420, comments: 185, shares: 92, ctr: "3.4%" }
  },
  {
    id: "p5",
    platform: "Twitter / X",
    content: "Automated invoice collection is here. Save 14+ hours per week with MiraTech's intelligent quotation-to-ledger pipeline conversion.",
    scheduledTime: "2026-08-08T15:00",
    status: "published",
    campaign: "Productivity Series",
    metrics: { impressions: 18200, likes: 980, comments: 74, shares: 41, ctr: "4.1%" }
  }
];

const PERFORMANCE_TREND = [
  { day: "Mon", impressions: 18400, engagement: 820, clicks: 410 },
  { day: "Tue", impressions: 22100, engagement: 1050, clicks: 530 },
  { day: "Wed", impressions: 19800, engagement: 910, clicks: 480 },
  { day: "Thu", impressions: 27500, engagement: 1420, clicks: 710 },
  { day: "Fri", impressions: 31000, engagement: 1650, clicks: 890 },
  { day: "Sat", impressions: 24000, engagement: 1100, clicks: 550 },
  { day: "Sun", impressions: 29700, engagement: 1380, clicks: 680 },
];

const PLATFORM_BREAKDOWN = [
  { name: "LinkedIn", value: 45, color: "#2563EB" },
  { name: "Twitter / X", value: 30, color: "#0F172A" },
  { name: "Instagram", value: 15, color: "#DB2777" },
  { name: "Facebook", value: 10, color: "#4F46E5" },
];

export default function SocialMediaHub({ companyId }: { companyId: string }) {
  const addToast = useToastStore((state) => state.addToast);
  const [activeTab, setActiveTab] = useState<"posts" | "analytics" | "accounts">("posts");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>(INITIAL_POSTS);
  const [accounts, setAccounts] = useState<SocialAccount[]>(INITIAL_ACCOUNTS);
  
  useEffect(() => {
    const qCampaigns = query(collection(db, 'companies', companyId, 'campaigns'));
    const qLeads = query(collection(db, 'companies', companyId, 'leads'));
    
    const unsubCampaigns = onSnapshot(qCampaigns, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => {
      unsubCampaigns();
      unsubLeads();
    };
  }, [companyId]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State for New/Edit Post
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  
  // Form State
  const [formPlatform, setFormPlatform] = useState("LinkedIn");
  const [formContent, setFormContent] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formCampaign, setFormCampaign] = useState("General Brand Campaign");
  const [formStatus, setFormStatus] = useState<"scheduled" | "published" | "draft">("scheduled");
  const [generatingAi, setGeneratingAi] = useState(false);

  // Handle Create or Update Post
  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) {
      addToast("Post content cannot be empty", "error");
      return;
    }

    if (editingPost) {
      setPosts(posts.map(p => p.id === editingPost.id ? {
        ...p,
        platform: formPlatform,
        content: formContent,
        scheduledTime: formTime || p.scheduledTime,
        status: formStatus,
        campaign: formCampaign
      } : p));
      addToast("Scheduled post updated successfully", "success");
    } else {
      const newPost: ScheduledPost = {
        id: `p_${Date.now()}`,
        platform: formPlatform,
        content: formContent,
        scheduledTime: formTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        status: formStatus,
        campaign: formCampaign,
        metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, ctr: "0.0%" }
      };
      setPosts([newPost, ...posts]);
      addToast("New social post scheduled successfully", "success");
    }

    setIsModalOpen(false);
    setEditingPost(null);
    setFormContent("");
  };

  const handleEditClick = (post: ScheduledPost) => {
    setEditingPost(post);
    setFormPlatform(post.platform);
    setFormContent(post.content);
    setFormTime(post.scheduledTime);
    setFormCampaign(post.campaign || "General");
    setFormStatus(post.status);
    setIsModalOpen(true);
  };

  const handleDeletePost = (id: string) => {
    setPosts(posts.filter(p => p.id !== id));
    addToast("Post removed from schedule", "success");
  };

  const handlePublishNow = (id: string) => {
    setPosts(posts.map(p => p.id === id ? { 
      ...p, 
      status: "published",
      metrics: { impressions: 1200, likes: 85, comments: 12, shares: 6, ctr: "2.8%" }
    } : p));
    addToast("Post published to live social feeds successfully", "success");
  };

  // AI Generator simulation
  const handleAiGenerate = async () => {
    setGeneratingAi(true);
    setTimeout(() => {
      const aiIdeas = [
        "Excited to share how MiraTech's automated financial ledgers are transforming enterprise productivity. Streamline your workflow today! 🚀 #Enterprise #Innovation",
        "Did you know? Teams using integrated project sprints and invoice pipelines complete milestones 3x faster. Discover our latest updates. 💡 #Productivity",
        "Security is our top priority. Cryptographic audit trails ensure absolute compliance across all departments. Explore the SecOps dashboard. 🛡️ #Security"
      ];
      const randomIdea = aiIdeas[Math.floor(Math.random() * aiIdeas.length)];
      setFormContent(randomIdea);
      setGeneratingAi(false);
      addToast("AI generated professional social copy", "success");
    }, 800);
  };

  // Filtered posts
  const filteredPosts = posts.filter(p => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || p.platform === platformFilter;
    const matchesSearch = p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.campaign.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPlatform && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/10 rounded-lg backdrop-blur-xs text-indigo-400">
              <Share2 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/10 text-indigo-200 px-2.5 py-0.5 rounded-full">
              Marketing Hub & Social Suite
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Social Media & Performance Analytics
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-xl">
            Manage scheduled posts across LinkedIn, Twitter/X, Instagram, and Facebook while monitoring live impressions, engagement rates, and channel ROI.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingPost(null);
            setFormContent("");
            setFormTime(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition uppercase tracking-wider cursor-pointer self-start sm:self-center shrink-0"
        >
          <Plus className="w-4 h-4" /> Schedule New Post
        </button>
      </div>

      {/* Sub-Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition uppercase tracking-wider cursor-pointer ${
            activeTab === "posts"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Scheduled Posts ({posts.filter(p => p.status === 'scheduled').length})
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition uppercase tracking-wider cursor-pointer ${
            activeTab === "analytics"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Performance Analytics
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition uppercase tracking-wider cursor-pointer ${
            activeTab === "accounts"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Connected Accounts ({accounts.length})
        </button>
      </div>

      {/* TAB 1: SCHEDULED & PUBLISHED POSTS */}
      {activeTab === "posts" && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters & Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-4xs">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search posts or campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>

              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Platforms</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Twitter / X">Twitter / X</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
              </select>
            </div>
          </div>

          {/* Posts List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPosts.length === 0 ? (
              <div className="col-span-2 py-12 text-center bg-white border border-slate-200 rounded-xl space-y-2">
                <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No social posts found matching your criteria.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div 
                  key={post.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-4xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Platform & Status Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {post.platform}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {post.campaign}
                        </span>
                      </div>

                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        post.status === 'published' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : post.status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {post.status}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      &ldquo;{post.content}&rdquo;
                    </p>
                  </div>

                  {/* Footer metadata & actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(post.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {post.status === "scheduled" && (
                        <button
                          onClick={() => handlePublishNow(post.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md transition flex items-center gap-1 cursor-pointer"
                          title="Publish Now"
                        >
                          <Send className="w-3 h-3" /> Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleEditClick(post)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition cursor-pointer"
                        title="Edit Post"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                        title="Delete Post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics if published */}
                  {post.status === 'published' && post.metrics && (
                    <div className="grid grid-cols-4 gap-2 pt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center font-mono">
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold block">Reach</span>
                        <span className="text-[10px] font-black text-slate-800">{post.metrics.impressions?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold block">Likes</span>
                        <span className="text-[10px] font-black text-indigo-600">{post.metrics.likes}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold block">Comments</span>
                        <span className="text-[10px] font-black text-emerald-600">{post.metrics.comments}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold block">CTR</span>
                        <span className="text-[10px] font-black text-violet-600">{post.metrics.ctr}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-4xs space-y-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Impressions</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 tracking-tight">142,500</span>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">+18.4%</span>
              </div>
              <span className="text-[8px] text-slate-400">Compared to previous 7 days</span>
            </div>

            <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-4xs space-y-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Engagement Rate</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-600 tracking-tight">4.82%</span>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">+0.65%</span>
              </div>
              <span className="text-[8px] text-slate-400">Average across 4 platforms</span>
            </div>

            <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-4xs space-y-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Click-Through Rate (CTR)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-violet-600 tracking-tight">2.94%</span>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">+0.41%</span>
              </div>
              <span className="text-[8px] text-slate-400">Landing page conversions</span>
            </div>

            <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-4xs space-y-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Follower Growth</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-emerald-600 tracking-tight">+1,240</span>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Monthly</span>
              </div>
              <span className="text-[8px] text-slate-400">Total network reach: 64.6K</span>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Area Chart */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-4xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Weekly Impressions & Engagement Trend</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Consolidated social reach and interaction volume over the last 7 days.</p>
                </div>
                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase">
                  Live Telemetry
                </span>
              </div>

              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={PERFORMANCE_TREND} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="day" stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <RechartsTooltip formatter={(val) => [val.toLocaleString(), "Impressions"]} />
                    <Area type="monotone" dataKey="impressions" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorImpressions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platform Share Pie Chart */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-4xs space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Platform Audience Share</h3>
                <p className="text-[10px] text-slate-500 font-semibold">Distribution of active campaign interactions by network.</p>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={PLATFORM_BREAKDOWN}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {PLATFORM_BREAKDOWN.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val) => [`${val}%`, "Share"]} />
                    <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 9, fontWeight: "bold" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONNECTED ACCOUNTS */}
      {activeTab === "accounts" && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-4xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Social Network Integrations</h3>
                <p className="text-[10px] text-slate-500 font-semibold">Manage authenticated API tokens and publishing permissions for corporate channels.</p>
              </div>
              <button
                onClick={() => addToast("OAuth token refresh sequence initiated successfully", "success")}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg transition uppercase tracking-wider cursor-pointer"
              >
                Sync All Tokens
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="border border-slate-200 rounded-xl p-4.5 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs shadow-3xs ${acc.avatarColor}`}>
                      {acc.platform.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-slate-900">{acc.platform}</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-semibold">{acc.handle}</p>
                      <span className="text-[9px] text-indigo-600 font-bold block">{acc.followers.toLocaleString()} followers</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {acc.status}
                    </span>
                    <button 
                      onClick={() => addToast(`Re-authenticated ${acc.platform} session`, "success")}
                      className="text-[9px] text-slate-500 hover:text-slate-900 font-bold underline cursor-pointer mt-1"
                    >
                      Configure API
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE / EDIT POST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-3xs animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Share2 className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                  {editingPost ? "Edit Scheduled Social Post" : "Schedule New Social Post"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 uppercase text-[9px]">Target Platform</label>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Twitter / X">Twitter / X</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 uppercase text-[9px]">Campaign Name</label>
                  <input
                    type="text"
                    value={formCampaign}
                    onChange={(e) => setFormCampaign(e.target.value)}
                    placeholder="e.g. Q3 Launch"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-700 uppercase text-[9px]">Post Caption & Content</label>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={generatingAi}
                    className="flex items-center gap-1 text-[9px] font-black text-indigo-600 hover:text-indigo-700 cursor-pointer disabled:opacity-50"
                  >
                    {generatingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Copywriter Assistant
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write your engaging social media update here..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 uppercase text-[9px]">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 uppercase text-[9px]">Post Status</label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Save as Draft</option>
                    <option value="published">Publish Immediately</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
