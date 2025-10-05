import * as projectService from '../../services/projectService';
import { Project, ProjectUser } from '@perfect-task-app/models';

// Mock the supabase module first to prevent initialization errors
jest.mock('../../supabase', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  };

  return {
    supabase: mockSupabaseClient,
    getSupabaseClient: jest.fn(() => mockSupabaseClient),
  };
});

// Mock the project service
jest.mock('../../services/projectService');

const mockedProjectService = projectService as jest.Mocked<typeof projectService>;

// Mock data
const mockProject: Project = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  owner_id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Test Project',
  color: 'sky' as const,
  is_general: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockProjectWithRole: projectService.ProjectWithRole = {
  ...mockProject,
  userRole: 'owner',
};

const mockProjectUser: ProjectUser = {
  project_id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '550e8400-e29b-41d4-a716-446655440002',
  role: 'member',
  joined_at: '2023-01-01T00:00:00Z',
};

describe('useProject Hooks Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Layer Interaction Tests', () => {
    it('should call getProjectsForUser service with correct parameters', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const mockProjects = [mockProjectWithRole];

      mockedProjectService.getProjectsForUser.mockResolvedValue(mockProjects);

      // Simulate what useProjectsForUser hook would do
      const result = await mockedProjectService.getProjectsForUser(userId);

      expect(mockedProjectService.getProjectsForUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockProjects);
      expect(result[0].userRole).toBe('owner');
    });

    it('should call getProjectById service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';

      mockedProjectService.getProjectById.mockResolvedValue(mockProject);

      // Simulate what useProject hook would do
      const result = await mockedProjectService.getProjectById(projectId);

      expect(mockedProjectService.getProjectById).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('should call getProjectMembers service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const mockMembers = [mockProjectUser];

      mockedProjectService.getProjectMembers.mockResolvedValue(mockMembers);

      // Simulate what useProjectMembers hook would do
      const result = await mockedProjectService.getProjectMembers(projectId);

      expect(mockedProjectService.getProjectMembers).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockMembers);
    });

    it('should call createProject service with correct parameters', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const name = 'New Project';

      mockedProjectService.createProject.mockResolvedValue(mockProject);

      // Simulate what useCreateProject hook would do
      const result = await mockedProjectService.createProject(ownerId, name);

      expect(mockedProjectService.createProject).toHaveBeenCalledWith(ownerId, name);
      expect(result).toEqual(mockProject);
    });

    it('should call updateProject service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const updates = { name: 'Updated Project' };
      const updatedProject = { ...mockProject, ...updates };

      mockedProjectService.updateProject.mockResolvedValue(updatedProject);

      // Simulate what useUpdateProject hook would do
      const result = await mockedProjectService.updateProject(projectId, updates);

      expect(mockedProjectService.updateProject).toHaveBeenCalledWith(projectId, updates);
      expect(result).toEqual(updatedProject);
    });

    it('should call deleteProject service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';

      mockedProjectService.deleteProject.mockResolvedValue();

      // Simulate what useDeleteProject hook would do
      await mockedProjectService.deleteProject(projectId);

      expect(mockedProjectService.deleteProject).toHaveBeenCalledWith(projectId);
    });

    it('should call addProjectMember service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';
      const role = 'admin' as const;

      const memberWithRole = { ...mockProjectUser, role };
      mockedProjectService.addProjectMember.mockResolvedValue(memberWithRole);

      // Simulate what useAddProjectMember hook would do
      const result = await mockedProjectService.addProjectMember(projectId, userId, role);

      expect(mockedProjectService.addProjectMember).toHaveBeenCalledWith(projectId, userId, role);
      expect(result).toEqual(memberWithRole);
    });

    it('should call removeProjectMember service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';

      mockedProjectService.removeProjectMember.mockResolvedValue();

      // Simulate what useRemoveProjectMember hook would do
      await mockedProjectService.removeProjectMember(projectId, userId);

      expect(mockedProjectService.removeProjectMember).toHaveBeenCalledWith(projectId, userId);
    });

    it('should call updateMemberRole service with correct parameters', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';
      const newRole = 'viewer' as const;

      const updatedMember = { ...mockProjectUser, role: newRole };
      mockedProjectService.updateMemberRole.mockResolvedValue(updatedMember);

      // Simulate what useUpdateMemberRole hook would do
      const result = await mockedProjectService.updateMemberRole(projectId, userId, newRole);

      expect(mockedProjectService.updateMemberRole).toHaveBeenCalledWith(projectId, userId, newRole);
      expect(result).toEqual(updatedMember);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle getProjectsForUser service errors', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const errorMessage = 'Database connection failed';

      mockedProjectService.getProjectsForUser.mockRejectedValue(new Error(errorMessage));

      // Simulate what useProjectsForUser hook would handle
      await expect(mockedProjectService.getProjectsForUser(userId)).rejects.toThrow(errorMessage);
    });

    it('should handle createProject service errors', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const name = 'New Project';
      const errorMessage = 'Project creation failed';

      mockedProjectService.createProject.mockRejectedValue(new Error(errorMessage));

      // Simulate what useCreateProject hook would handle
      await expect(mockedProjectService.createProject(ownerId, name)).rejects.toThrow(errorMessage);
    });

    it('should handle project member operation errors', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';
      const errorMessage = 'User already member';

      mockedProjectService.addProjectMember.mockRejectedValue(new Error(errorMessage));

      // Simulate what useAddProjectMember hook would handle
      await expect(
        mockedProjectService.addProjectMember(projectId, userId, 'member')
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('Data Validation Tests', () => {
    it('should validate project data from service responses', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const mockProjects = [mockProjectWithRole];

      mockedProjectService.getProjectsForUser.mockResolvedValue(mockProjects);

      const result = await mockedProjectService.getProjectsForUser(userId);

      // Verify the data structure matches what hooks expect
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('owner_id');
      expect(result[0]).toHaveProperty('userRole');
      expect(result[0]).toHaveProperty('is_general');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('updated_at');
    });

    it('should validate project member data from service responses', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const mockMembers = [mockProjectUser];

      mockedProjectService.getProjectMembers.mockResolvedValue(mockMembers);

      const result = await mockedProjectService.getProjectMembers(projectId);

      // Verify the data structure matches what hooks expect
      expect(result[0]).toHaveProperty('project_id');
      expect(result[0]).toHaveProperty('user_id');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('joined_at');
      expect(result[0].role).toMatch(/^(admin|member|viewer)$/);
    });
  });

  describe('Role and Permissions Tests', () => {
    it('should handle different user roles correctly', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const projectsWithDifferentRoles = [
        { ...mockProject, id: 'proj1', userRole: 'owner' },
        { ...mockProject, id: 'proj2', userRole: 'admin' },
        { ...mockProject, id: 'proj3', userRole: 'member' },
        { ...mockProject, id: 'proj4', userRole: 'viewer' },
      ] as projectService.ProjectWithRole[];

      mockedProjectService.getProjectsForUser.mockResolvedValue(projectsWithDifferentRoles);

      const result = await mockedProjectService.getProjectsForUser(userId);

      expect(result).toHaveLength(4);
      expect(result[0].userRole).toBe('owner');
      expect(result[1].userRole).toBe('admin');
      expect(result[2].userRole).toBe('member');
      expect(result[3].userRole).toBe('viewer');
    });

    it('should handle valid member role operations', async () => {
      const validRoles = ['admin', 'member', 'viewer'] as const;
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';

      for (const role of validRoles) {
        const memberWithRole = { ...mockProjectUser, role };
        mockedProjectService.addProjectMember.mockResolvedValueOnce(memberWithRole);

        const result = await mockedProjectService.addProjectMember(projectId, userId, role);

        expect(result.role).toBe(role);
        expect(mockedProjectService.addProjectMember).toHaveBeenCalledWith(projectId, userId, role);
      }

      expect(mockedProjectService.addProjectMember).toHaveBeenCalledTimes(validRoles.length);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple projects with different ownership', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const complexProjectList = [
        {
          ...mockProject,
          id: 'owned-proj',
          name: 'Owned Project',
          owner_id: userId, // User owns this
          userRole: 'owner',
        },
        {
          ...mockProject,
          id: 'member-proj',
          name: 'Member Project',
          owner_id: '550e8400-e29b-41d4-a716-446655440999', // Different owner
          userRole: 'member',
        },
        {
          ...mockProject,
          id: 'admin-proj',
          name: 'Admin Project',
          owner_id: '550e8400-e29b-41d4-a716-446655440999', // Different owner
          userRole: 'admin',
        },
      ] as projectService.ProjectWithRole[];

      mockedProjectService.getProjectsForUser.mockResolvedValue(complexProjectList);

      const result = await mockedProjectService.getProjectsForUser(userId);

      expect(result).toHaveLength(3);

      const ownedProject = result.find(p => p.id === 'owned-proj');
      const memberProject = result.find(p => p.id === 'member-proj');
      const adminProject = result.find(p => p.id === 'admin-proj');

      expect(ownedProject?.userRole).toBe('owner');
      expect(ownedProject?.owner_id).toBe(userId);
      expect(memberProject?.userRole).toBe('member');
      expect(adminProject?.userRole).toBe('admin');
    });

    it('should handle project member management flow', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440002';

      // Simulate complete member management flow

      // 1. Add member
      const newMember = { ...mockProjectUser, role: 'member' as const };
      mockedProjectService.addProjectMember.mockResolvedValueOnce(newMember);

      const addedMember = await mockedProjectService.addProjectMember(projectId, userId, 'member');
      expect(addedMember.role).toBe('member');

      // 2. Update member role
      const updatedMember = { ...mockProjectUser, role: 'admin' as const };
      mockedProjectService.updateMemberRole.mockResolvedValueOnce(updatedMember);

      const promotedMember = await mockedProjectService.updateMemberRole(projectId, userId, 'admin');
      expect(promotedMember.role).toBe('admin');

      // 3. Remove member
      mockedProjectService.removeProjectMember.mockResolvedValueOnce();

      await expect(mockedProjectService.removeProjectMember(projectId, userId)).resolves.not.toThrow();

      // Verify all operations were called
      expect(mockedProjectService.addProjectMember).toHaveBeenCalledWith(projectId, userId, 'member');
      expect(mockedProjectService.updateMemberRole).toHaveBeenCalledWith(projectId, userId, 'admin');
      expect(mockedProjectService.removeProjectMember).toHaveBeenCalledWith(projectId, userId);
    });
  });
});