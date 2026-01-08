"use client"
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { MessageSquare, Users, TrendingUp, Bot, Calendar, DollarSign, Activity, Clock, Target, Loader2 } from 'lucide-react';

interface DashboardStats {
  totalChatbots: number;
  totalConversations: number;
  activeConversations: number;
  totalLeads: number;
  conversionRate: number;
  avgResponseTime: string;
  totalWorkspaces: number;
  totalMessages: number;
}

interface ConversationData {
  date: string;
  conversations: number;
  messages: number;
  leads: number;
}

interface ChatbotPerformance {
  name: string;
  conversations: number;
  leads: number;
  satisfaction: number;
}

interface ChartData {
  name: string;
  value: number;
  count?: number;
  color?: string;
  percentage?: number;
  [key: string]: string | number | undefined;
}

interface HourlyActivity {
  hour: string;
  activity: number;
}

interface DashboardData {
  stats: DashboardStats;
  conversationData: ConversationData[];
  chatbotPerformance: ChatbotPerformance[];
  leadSourceData: ChartData[];
  flowTypeData: ChartData[];
  hourlyActivity: HourlyActivity[];
  logicTypeUsage: ChartData[];
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/dashboard?timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">{error}</p>
            <button 
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { stats, conversationData, chatbotPerformance, leadSourceData, flowTypeData, hourlyActivity, logicTypeUsage } = data;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">Welcome back! Here's what's happening with your chatbots.</p>
          </div>
          <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto">
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Chatbots</CardTitle>
              <Bot className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.totalChatbots}</div>
              <p className="text-xs text-green-600 mt-1">+2 from last month</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.totalConversations}</div>
              <p className="text-xs text-green-600 mt-1">+12.5% vs last week</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.totalLeads}</div>
              <p className="text-xs text-green-600 mt-1">Conversion: {stats.conversionRate}%</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.avgResponseTime}</div>
              <p className="text-xs text-green-600 mt-1">-0.3s improvement</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversations Trend */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Conversation Trends
              </CardTitle>
              <CardDescription>Daily conversation and message activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={conversationData}>
                  <defs>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(263, 70%, 60%)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(263, 70%, 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 90%)" />
                  <XAxis dataKey="date" stroke="hsl(215, 16%, 47%)" />
                  <YAxis stroke="hsl(215, 16%, 47%)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(0, 0%, 100%)', border: '1px solid hsl(215, 20%, 90%)', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="conversations" stroke="hsl(217, 91%, 60%)" fillOpacity={1} fill="url(#colorConv)" />
                  <Area type="monotone" dataKey="messages" stroke="hsl(263, 70%, 60%)" fillOpacity={1} fill="url(#colorMsg)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chatbot Performance */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                Chatbot Performance
              </CardTitle>
              <CardDescription>Conversations and leads by chatbot</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chatbotPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 90%)" />
                  <XAxis dataKey="name" stroke="hsl(215, 16%, 47%)" angle={-15} textAnchor="end" height={80} />
                  <YAxis stroke="hsl(215, 16%, 47%)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(0, 0%, 100%)', border: '1px solid hsl(215, 20%, 90%)', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="conversations" fill="hsl(217, 91%, 60%)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="leads" fill="hsl(142, 76%, 45%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Sources */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Lead Sources
              </CardTitle>
              <CardDescription>Distribution by form type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={leadSourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => {
                      if (percent === undefined) return name;
                      return `${name} ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {leadSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || `hsl(${index * 45}, 70%, 60%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Flow Types */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Flow Distribution
              </CardTitle>
              <CardDescription>Active flows by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {flowTypeData.map((flow, index) => {
                  const maxCount = Math.max(...flowTypeData.map(f => f.count || f.value));
                  const percentage = ((flow.count || flow.value) / maxCount) * 100;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{flow.name}</span>
                        <span className="text-sm font-bold text-slate-900">{flow.count || flow.value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: flow.color || `hsl(${index * 60}, 70%, 50%)`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Logic Type Usage */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-cyan-500" />
                Logic Actions
              </CardTitle>
              <CardDescription>Most used logic types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logicTypeUsage.map((logic, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{logic.name}</div>
                      <div className="text-xs text-slate-600">{logic.count || logic.value} uses</div>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {logic.percentage || Math.round((logic.value / logicTypeUsage.reduce((acc, l) => acc + (l.count || l.value), 0)) * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hourly Activity & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Activity by Hour</CardTitle>
              <CardDescription>Peak usage times throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 90%)" />
                  <XAxis dataKey="hour" stroke="hsl(215, 16%, 47%)" />
                  <YAxis stroke="hsl(215, 16%, 47%)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(0, 0%, 100%)', border: '1px solid hsl(215, 20%, 90%)', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="activity" stroke="hsl(188, 94%, 43%)" strokeWidth={3} dot={{ fill: 'hsl(188, 94%, 43%)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Additional insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Active Now</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">{stats.activeConversations}</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Total Messages</div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">{stats.totalMessages.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <div className="text-sm text-emerald-600 font-medium">Workspaces</div>
                  <div className="text-2xl font-bold text-emerald-900 mt-1">{stats.totalWorkspaces}</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-600 font-medium">Conversion</div>
                  <div className="text-2xl font-bold text-orange-900 mt-1">{stats.conversionRate}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}