import { Workspace, User, AuditLog } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { 
  Workspace as IWorkspace, 
  CreateWorkspaceRequest, 
  UserRole,
  PaginationQuery,
  WorkspaceMember 
} from '@shared/types/index.js';

export class WorkspaceService {
  static async create(userId: string, data: CreateWorkspaceRequest): Promise<IWorkspace> {
    const workspace = await Workspace.create({
      name: data.name,
      description: data.description || '',
      ownerId: userId,
    });

    // Log audit
    await AuditLog.create({
      workspaceId: workspace._id.toString(),
      userId,
      action: 'create',
      resource: 'workspace',
      resourceId: workspace._id.toString(),
      details: { name: data.name },
      timestamp: new Date().toISOString(),
    });

    return workspace.toJSON() as IWorkspace;
  }

  static async findById(workspaceId: string, userId: string): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Check if user is a member
    const isMember = workspace.members.some((m: any) => m.userId === userId);
    if (!isMember) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    return workspace.toJSON() as IWorkspace;
  }

  static async findByUser(userId: string, query: PaginationQuery = {}): Promise<{
    workspaces: IWorkspace[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const filter = { 'members.userId': userId };
    
    const [workspaces, total] = await Promise.all([
      Workspace.find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Workspace.countDocuments(filter),
    ]);

    return {
      workspaces: workspaces.map(w => w.toJSON() as IWorkspace),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async update(
    workspaceId: string, 
    userId: string, 
    data: Partial<CreateWorkspaceRequest>
  ): Promise<IWorkspace> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Check if user has admin access
    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member || member.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    if (data.name) workspace.name = data.name;
    if (data.description !== undefined) workspace.description = data.description;
    
    await workspace.save();

    await AuditLog.create({
      workspaceId: workspace._id.toString(),
      userId,
      action: 'update',
      resource: 'workspace',
      resourceId: workspace._id.toString(),
      details: data,
      timestamp: new Date().toISOString(),
    });

    return workspace.toJSON() as IWorkspace;
  }

  static async delete(workspaceId: string, userId: string): Promise<void> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    if (workspace.ownerId !== userId) {
      throw new AppError('Only owner can delete workspace', 403, 'OWNER_REQUIRED');
    }

    await workspace.deleteOne();

    await AuditLog.create({
      workspaceId,
      userId,
      action: 'delete',
      resource: 'workspace',
      resourceId: workspaceId,
      details: { name: workspace.name },
      timestamp: new Date().toISOString(),
    });
  }

  static async inviteMember(
    workspaceId: string,
    inviterId: string,
    email: string,
    role: UserRole
  ): Promise<WorkspaceMember> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Check inviter has admin access
    const inviter = workspace.members.find((m: any) => m.userId === inviterId);
    if (!inviter || inviter.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if already a member
    const existing = workspace.members.find((m: any) => m.userId === user._id.toString());
    if (existing) {
      throw new AppError('User is already a member', 409, 'ALREADY_MEMBER');
    }

    const newMember: WorkspaceMember = {
      userId: user._id.toString(),
      role,
      joinedAt: new Date().toISOString(),
    };

    workspace.members.push(newMember);
    await workspace.save();

    await AuditLog.create({
      workspaceId,
      userId: inviterId,
      action: 'invite',
      resource: 'member',
      resourceId: user._id.toString(),
      details: { email, role },
      timestamp: new Date().toISOString(),
    });

    return newMember;
  }

  static async removeMember(
    workspaceId: string,
    removerId: string,
    memberId: string
  ): Promise<void> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Can't remove owner
    if (memberId === workspace.ownerId) {
      throw new AppError('Cannot remove workspace owner', 400, 'CANNOT_REMOVE_OWNER');
    }

    // Check remover has admin access (or is removing themselves)
    const remover = workspace.members.find((m: any) => m.userId === removerId);
    if (removerId !== memberId && (!remover || remover.role !== 'admin')) {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const memberIndex = workspace.members.findIndex((m: any) => m.userId === memberId);
    if (memberIndex === -1) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    await AuditLog.create({
      workspaceId,
      userId: removerId,
      action: 'remove',
      resource: 'member',
      resourceId: memberId,
      details: { removedBy: removerId },
      timestamp: new Date().toISOString(),
    });
  }

  static async updateMemberRole(
    workspaceId: string,
    updaterId: string,
    memberId: string,
    newRole: UserRole
  ): Promise<WorkspaceMember> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Check updater has admin access
    const updater = workspace.members.find((m: any) => m.userId === updaterId);
    if (!updater || updater.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    const member = workspace.members.find((m: any) => m.userId === memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // Can't change owner's role
    if (memberId === workspace.ownerId) {
      throw new AppError('Cannot change owner role', 400, 'CANNOT_CHANGE_OWNER');
    }

    const oldRole = member.role;
    member.role = newRole;
    await workspace.save();

    await AuditLog.create({
      workspaceId,
      userId: updaterId,
      action: 'update',
      resource: 'member',
      resourceId: memberId,
      details: { oldRole, newRole },
      timestamp: new Date().toISOString(),
    });

    return member;
  }

  static async getMembers(
    workspaceId: string,
    userId: string
  ): Promise<{ userId: string; name: string; email: string; role: UserRole; avatar: string; color: string; joinedAt: string }[]> {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // Check if user is a member
    const isMember = workspace.members.some((m: any) => m.userId === userId);
    if (!isMember) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Load full user data for each member
    const memberUserIds = workspace.members.map((m: any) => m.userId);
    const users = await User.find({ _id: { $in: memberUserIds } });
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return workspace.members.map((member: any) => {
      const user = userMap.get(member.userId);
      return {
        userId: member.userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        role: member.role as UserRole,
        avatar: user?.avatar || '??',
        color: user?.color || '#888888',
        joinedAt: member.joinedAt,
      };
    });
  }

  static async getMemberRole(workspaceId: string, userId: string): Promise<UserRole | null> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return null;
    
    const member = workspace.members.find((m: any) => m.userId === userId);
    return member?.role as UserRole || null;
  }
}

export default WorkspaceService;
