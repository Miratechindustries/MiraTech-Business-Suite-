import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { companyId, projectId, taskId, newStatus } = await req.json();
    
    if (!companyId || !projectId || !taskId || !newStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const taskRef = adminDb.collection('companies').doc(companyId).collection('tasks').doc(taskId);
    const projectRef = adminDb.collection('companies').doc(companyId).collection('projects').doc(projectId);

    await adminDb.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) throw new Error('Task not found');
      
      const projectDoc = await transaction.get(projectRef);
      if (!projectDoc.exists) throw new Error('Project not found');

      const oldStatus = taskDoc.data()?.status;
      
      // Update Task
      transaction.update(taskRef, { 
        status: newStatus,
        updatedAt: Timestamp.now().toDate().toISOString()
      });
      
      // Update Project Aggregate
      const completedTasks = projectDoc.data()?.completedTaskCount || 0;
      const totalTasks = projectDoc.data()?.totalTaskCount || 1;
      
      let newCompletedCount = completedTasks;
      if (oldStatus !== 'done' && newStatus === 'done') {
        newCompletedCount++;
      } else if (oldStatus === 'done' && newStatus !== 'done') {
        newCompletedCount--;
      }
      
      transaction.update(projectRef, { 
        completedTaskCount: newCompletedCount,
        lastUpdatedAt: Timestamp.now().toDate().toISOString()
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating task:', error);
    if (error.message.includes('permission')) {
        return NextResponse.json({ error: 'Missing or insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
