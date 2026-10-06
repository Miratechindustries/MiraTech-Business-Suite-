import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      companyId, 
      projectId, 
      taskId, 
      newStatus, 
      action = 'update_status', 
      title, 
      description = '', 
      priority = 'medium',
      departmentId = '',
      assignedEmployeeId = ''
    } = body;
    
    if (!companyId) {
      return NextResponse.json({ error: 'Missing required field: companyId' }, { status: 400 });
    }

    const tasksColRef = adminDb.collection('companies').doc(companyId).collection('tasks');

    // 1. ACTION: CREATE
    if (action === 'create') {
      if (!title || !title.trim()) {
        return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
      }

      const newTaskRef = tasksColRef.doc();
      const nowIso = new Date().toISOString();

      const taskPayload = {
        title: title.trim(),
        description: description ? description.trim() : '',
        status: newStatus || 'todo',
        priority: priority || 'medium',
        projectId: projectId || '',
        departmentId: departmentId || '',
        assignedEmployeeId: assignedEmployeeId || '',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await newTaskRef.set(taskPayload);

      // Increment project total task count if attached to a valid project
      if (projectId && projectId !== 'default') {
        try {
          const projectRef = adminDb.collection('companies').doc(companyId).collection('projects').doc(projectId);
          const projectDoc = await projectRef.get();
          if (projectDoc.exists) {
            const currentTotal = projectDoc.data()?.totalTaskCount || 0;
            await projectRef.update({
              totalTaskCount: currentTotal + 1,
              lastUpdatedAt: nowIso
            });
          }
        } catch (projErr) {
          console.warn("Could not update project totalTaskCount:", projErr);
        }
      }

      return NextResponse.json({ success: true, taskId: newTaskRef.id, task: { id: newTaskRef.id, ...taskPayload } });
    }

    // 2. ACTION: DELETE
    if (action === 'delete') {
      if (!taskId) {
        return NextResponse.json({ error: 'Missing required field: taskId' }, { status: 400 });
      }

      const taskRef = tasksColRef.doc(taskId);
      const taskDoc = await taskRef.get();
      if (!taskDoc.exists) {
        return NextResponse.json({ success: true, message: 'Task already removed' });
      }

      const taskData = taskDoc.data();
      const wasDone = taskData?.status === 'done';
      const attachedProjectId = taskData?.projectId || projectId;

      await taskRef.delete();

      if (attachedProjectId && attachedProjectId !== 'default') {
        try {
          const projectRef = adminDb.collection('companies').doc(companyId).collection('projects').doc(attachedProjectId);
          const projectDoc = await projectRef.get();
          if (projectDoc.exists) {
            const pData = projectDoc.data();
            const currentTotal = Math.max(0, (pData?.totalTaskCount || 1) - 1);
            const currentCompleted = wasDone ? Math.max(0, (pData?.completedTaskCount || 1) - 1) : (pData?.completedTaskCount || 0);
            await projectRef.update({
              totalTaskCount: currentTotal,
              completedTaskCount: currentCompleted,
              lastUpdatedAt: new Date().toISOString()
            });
          }
        } catch (projErr) {
          console.warn("Could not decrement project task count:", projErr);
        }
      }

      return NextResponse.json({ success: true });
    }

    // 3. ACTION: UPDATE_STATUS (or default status toggle)
    if (!taskId || !newStatus) {
      return NextResponse.json({ error: 'Missing required fields: taskId and newStatus' }, { status: 400 });
    }

    const taskRef = tasksColRef.doc(taskId);
    const nowIso = new Date().toISOString();

    if (projectId && projectId !== 'default') {
      const projectRef = adminDb.collection('companies').doc(companyId).collection('projects').doc(projectId);

      await adminDb.runTransaction(async (transaction) => {
        const taskDoc = await transaction.get(taskRef);
        if (!taskDoc.exists) {
          // If task doesn't exist in Firestore yet, set it up
          transaction.set(taskRef, {
            title: title || 'Task',
            status: newStatus,
            projectId,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          return;
        }

        const oldStatus = taskDoc.data()?.status;

        transaction.update(taskRef, {
          status: newStatus,
          updatedAt: nowIso
        });

        const projectDoc = await transaction.get(projectRef);
        if (projectDoc.exists) {
          const pData = projectDoc.data();
          const completedTasks = pData?.completedTaskCount || 0;

          let newCompletedCount = completedTasks;
          if (oldStatus !== 'done' && newStatus === 'done') {
            newCompletedCount++;
          } else if (oldStatus === 'done' && newStatus !== 'done') {
            newCompletedCount = Math.max(0, completedTasks - 1);
          }

          transaction.update(projectRef, {
            completedTaskCount: newCompletedCount,
            lastUpdatedAt: nowIso
          });
        }
      });
    } else {
      await taskRef.update({
        status: newStatus,
        updatedAt: nowIso
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating task:', error);
    if (error?.message?.includes('permission')) {
      return NextResponse.json({ error: 'Missing or insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
