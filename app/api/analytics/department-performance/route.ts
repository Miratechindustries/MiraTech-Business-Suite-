import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const departmentId = searchParams.get('departmentId');
  return handleAnalytics(companyId, departmentId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, departmentId } = body;
    return handleAnalytics(companyId, departmentId);
  } catch (err) {
    console.error('Error parsing POST body in department-performance:', err);
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }
}

async function handleAnalytics(companyId: string | null, departmentId: string | null) {
  try {
    if (!companyId || !departmentId) {
      return NextResponse.json({ error: 'Missing companyId or departmentId' }, { status: 400 });
    }

    const deptRef = adminDb.doc(`companies/${companyId}/departments/${departmentId}`);
    const projCollRef = adminDb.collection('companies').doc(companyId).collection('projects');
    const taskCollRef = adminDb.collection('companies').doc(companyId).collection('tasks');
    const empCollRef = adminDb.collection('companies').doc(companyId).collection('employees');

    const [deptSnap, projSnap, allTasksSnap, empSnap] = await Promise.all([
      deptRef.get().catch(() => ({ exists: false, data: () => null })),
      projCollRef.get().catch(() => ({ docs: [] })),
      taskCollRef.get().catch(() => ({ docs: [] })),
      empCollRef.get().catch(() => ({ docs: [] }))
    ]);

    const deptData = deptSnap?.exists ? deptSnap.data() : null;
    
    // Filter projects matching this department or all projects if department is projects/general
    const allProjects = (projSnap?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const deptProjects = allProjects.filter((p: any) => 
      !p.departmentId || p.departmentId === departmentId || departmentId === 'projects' || departmentId === 'all'
    );
    const projectIds = new Set(deptProjects.map((p: any) => p.id));

    // Filter tasks belonging to matching projects or matching departmentId
    const allTasks = (allTasksSnap?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const deptTasks = allTasks.filter((t: any) => 
      t.departmentId === departmentId || (t.projectId && projectIds.has(t.projectId)) || departmentId === 'projects' || departmentId === 'all'
    );

    const allEmployees = (empSnap?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const deptEmployees = allEmployees.filter((e: any) => 
      !e.department || e.department.toLowerCase() === departmentId.toLowerCase() || departmentId === 'hr' || departmentId === 'all'
    );

    // Default capacity calculation
    const totalCapacity = deptData?.totalCapacity || (deptEmployees.length > 0 ? deptEmployees.length * 40 : 100);
    const assignedBudget = deptData?.assignedBudget || deptProjects.reduce((acc: number, p: any) => acc + (Number(p.budget) || 0), 0);
    
    const activeTasks = deptTasks.filter((t: any) => t.status === 'in-progress' || t.status === 'todo').length;
    const completedTasks = deptTasks.filter((t: any) => t.status === 'done').length;
    const totalTaskCount = deptTasks.length;

    const projectCompletionRate = totalTaskCount > 0 
      ? Math.round((completedTasks / totalTaskCount) * 100) / 100 
      : (deptProjects.length > 0 ? Math.round((deptProjects.filter((p: any) => p.status === 'completed').length / deptProjects.length) * 100) / 100 : 0);

    const resourceUtilizationRate = totalCapacity > 0 
      ? Math.min(1, Math.round(((activeTasks * 8) / totalCapacity) * 100) / 100) 
      : 0;

    return NextResponse.json({
      departmentId,
      totalCapacity,
      assignedBudget,
      activeTasks,
      completedTasks,
      totalTasks: totalTaskCount,
      projectCompletionRate,
      resourceUtilizationRate,
      projects: deptProjects,
      tasks: deptTasks,
      employees: deptEmployees
    });
  } catch (error) {
    console.error('Error in department-performance analytics API:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

