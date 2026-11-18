import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { wouldCreateCycle } from '../../utils/dagValidator.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as orgRepo from '../organizations/organizations.repository.js';
import * as taskRepo from './tasks.repository.js';

export async function listTasks(orgId, filters, userContext) {
  const { rows, total } = await taskRepo.listTasks(orgId, filters, userContext);
  return { items: rows, total };
}

export async function getTaskById(orgId, taskId) {
  const task = await taskRepo.findTaskDetails(orgId, taskId);
  if (!task) {
    throw AppError.notFound('Task not found.');
  }
  return task;
}

export async function createTask(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, name, project_code FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found in this organization.');
    }

    if (payload.milestoneId) {
      const msRes = await client.query(
        `SELECT id FROM project_milestones WHERE organization_id = $1 AND project_id = $2 AND id = $3`,
        [orgId, payload.projectId, payload.milestoneId]
      );
      if (!msRes.rows[0]) {
        throw AppError.badRequest('Milestone does not belong to this project.');
      }
    }

    if (payload.parentTaskId) {
      const parent = await taskRepo.findTaskBasic(orgId, payload.parentTaskId, client);
      if (!parent || parent.project_id !== payload.projectId) {
        throw AppError.badRequest('Parent task must belong to the same project.');
      }
    }

    for (const userId of payload.assigneeIds || []) {
      const member = await orgRepo.findMemberByUserId(orgId, userId, client);
      if (!member || member.status !== 'active') {
        throw AppError.badRequest('All assignees must be active members of this organization.');
      }
    }

    const created = await taskRepo.createTask(orgId, actorId, payload, client);
    const assignedIds = await taskRepo.replaceAssignees(
      created.id,
      payload.assigneeIds || [],
      actorId,
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'task.created',
        entityType: 'task',
        entityId: created.id,
        summary: `Created task "${created.title}" (${created.priority} priority)`,
        metadata: { status: created.status, assignees: assignedIds },
      },
      client
    );

    for (const assigneeId of assignedIds) {
      if (assigneeId !== actorId) {
        await createNotification(
          {
            organizationId: orgId,
            recipientId: assigneeId,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You were assigned "${created.title}" in [${project.project_code}] ${project.name}.`,
            entityType: 'task',
            entityId: created.id,
          },
          client
        );
      }
    }

    return created;
  });
}

export async function updateTask(orgId, taskId, actor, payload) {
  return withTransaction(async (client) => {
    const existing = await taskRepo.findTaskBasic(orgId, taskId, client);
    if (!existing) {
      throw AppError.notFound('Task not found.');
    }

    const currentAssignees = await taskRepo.getTaskAssigneeIds(taskId, client);
    const isManagerOrOwner =
      actor.isSuperAdmin || actor.orgRole === 'org_owner' || actor.orgRole === 'project_manager';

    if (!isManagerOrOwner) {
      if (actor.orgRole === 'stakeholder') {
        throw AppError.forbidden('Stakeholders have read-only access and cannot modify tasks.');
      }
      if (!currentAssignees.includes(actor.id)) {
        throw AppError.forbidden('You can only update progress on tasks assigned to you.');
      }
      // Team members are restricted to execution updates
      const allowedMemberFields = new Set(['status', 'progressPercent', 'actualHours']);
      const disallowed = Object.keys(payload).filter((k) => !allowedMemberFields.has(k));
      if (disallowed.length > 0) {
        throw AppError.forbidden(
          `Team members can only update status, progressPercent, and actualHours (attempted: ${disallowed.join(', ')}).`
        );
      }
    }

    const updateData = { ...payload };
    delete updateData.assigneeIds;

    if (updateData.status === 'completed' && existing.status !== 'completed') {
      updateData.completedAt = new Date();
      if (updateData.progressPercent === undefined) {
        updateData.progressPercent = 100;
      }
    } else if (updateData.status && updateData.status !== 'completed' && existing.status === 'completed') {
      updateData.completedAt = null;
    }

    const updated =
      Object.keys(updateData).length > 0
        ? await taskRepo.updateTask(orgId, taskId, updateData, client)
        : existing;

    if (payload.assigneeIds !== undefined) {
      for (const userId of payload.assigneeIds) {
        const member = await orgRepo.findMemberByUserId(orgId, userId, client);
        if (!member || member.status !== 'active') {
          throw AppError.badRequest('All assignees must be active members of this organization.');
        }
      }
      const nextAssignees = await taskRepo.replaceAssignees(taskId, payload.assigneeIds, actor.id, client);
      const newlyAdded = nextAssignees.filter((id) => !currentAssignees.includes(id) && id !== actor.id);
      for (const userId of newlyAdded) {
        await createNotification(
          {
            organizationId: orgId,
            recipientId: userId,
            type: 'task_assigned',
            title: 'Task Assigned to You',
            message: `You were assigned to task "${updated.title}".`,
            entityType: 'task',
            entityId: taskId,
          },
          client
        );
      }
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId: actor.id,
        action: updated.status === 'completed' && existing.status !== 'completed' ? 'task.completed' : 'task.updated',
        entityType: 'task',
        entityId: taskId,
        summary: `Updated task "${updated.title}" (${existing.status} → ${updated.status})`,
        metadata: { previousStatus: existing.status, newStatus: updated.status },
      },
      client
    );

    return updated;
  });
}

export async function deleteTask(orgId, taskId, actorId) {
  return withTransaction(async (client) => {
    const deleted = await taskRepo.deleteTask(orgId, taskId, client);
    if (!deleted) {
      throw AppError.notFound('Task not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: deleted.project_id,
        actorId,
        action: 'task.deleted',
        entityType: 'task',
        entityId: taskId,
        summary: `Deleted task "${deleted.title}"`,
      },
      client
    );

    return { deletedTaskId: taskId };
  });
}

export async function addDependency(orgId, taskId, dependsOnTaskId, actorId) {
  return withTransaction(async (client) => {
    const [task, prereq] = await Promise.all([
      taskRepo.findTaskBasic(orgId, taskId, client),
      taskRepo.findTaskBasic(orgId, dependsOnTaskId, client),
    ]);

    if (!task || !prereq) {
      throw AppError.notFound('Both tasks must exist in this organization.');
    }
    if (task.project_id !== prereq.project_id) {
      throw AppError.badRequest(
        'Task dependencies can only link tasks within the same project.',
        'CROSS_PROJECT_DEPENDENCY'
      );
    }

    const existingEdges = await taskRepo.getProjectDependencies(orgId, task.project_id, client);
    if (wouldCreateCycle(existingEdges, taskId, dependsOnTaskId)) {
      throw AppError.conflict(
        'Cannot add this dependency because it would create a circular dependency cycle.',
        'DEPENDENCY_CYCLE_DETECTED'
      );
    }

    const created = await taskRepo.addDependency(
      {
        organizationId: orgId,
        projectId: task.project_id,
        taskId,
        dependsOnTaskId,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: task.project_id,
        actorId,
        action: 'task.dependency_added',
        entityType: 'task',
        entityId: taskId,
        summary: `Added dependency: "${task.title}" depends on "${prereq.title}"`,
      },
      client
    );

    return created;
  });
}

export async function removeDependency(orgId, taskId, dependencyId) {
  return withTransaction(async (client) => {
    const removed = await taskRepo.removeDependency(orgId, taskId, dependencyId, client);
    if (!removed) {
      throw AppError.notFound('Dependency not found.');
    }
    return { removedDependencyId: dependencyId };
  });
}

export async function addComment(orgId, taskId, actorId, body) {
  return withTransaction(async (client) => {
    const task = await taskRepo.findTaskBasic(orgId, taskId, client);
    if (!task) {
      throw AppError.notFound('Task not found.');
    }

    const comment = await taskRepo.addComment(
      { organizationId: orgId, taskId, authorId: actorId, body },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: task.project_id,
        actorId,
        action: 'task.commented',
        entityType: 'task',
        entityId: taskId,
        summary: `Commented on task "${task.title}"`,
      },
      client
    );

    const assignees = await taskRepo.getTaskAssigneeIds(taskId, client);
    for (const userId of assignees) {
      if (userId !== actorId) {
        await createNotification(
          {
            organizationId: orgId,
            recipientId: userId,
            type: 'task_comment',
            title: 'New Comment on Assigned Task',
            message: `New comment added on "${task.title}".`,
            entityType: 'task',
            entityId: taskId,
          },
          client
        );
      }
    }

    return comment;
  });
}

export async function uploadAttachment(orgId, taskId, actorId, file) {
  if (!file) {
    throw AppError.badRequest('Attachment file is required.', 'FILE_REQUIRED');
  }

  return withTransaction(async (client) => {
    const task = await taskRepo.findTaskBasic(orgId, taskId, client);
    if (!task) {
      throw AppError.notFound('Task not found.');
    }

    const attachment = await taskRepo.addAttachment(
      {
        organizationId: orgId,
        taskId,
        uploadedBy: actorId,
        originalName: file.originalname,
        storedFilename: file.filename,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: task.project_id,
        actorId,
        action: 'task.attachment_uploaded',
        entityType: 'task',
        entityId: taskId,
        summary: `Uploaded evidence "${file.originalname}" to task "${task.title}"`,
      },
      client
    );

    return attachment;
  });
}

export async function getAttachmentForDownload(orgId, attachmentId) {
  const file = await taskRepo.findAttachmentById(orgId, attachmentId);
  if (!file) {
    throw AppError.notFound('Attachment not found.');
  }
  return file;
}
