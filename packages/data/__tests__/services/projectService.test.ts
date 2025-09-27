import * as projectService from '../../services/projectService';
import { ProjectSchema, ProjectUserSchema } from '@perfect-task-app/models';

// Mock the entire supabase module
jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
        or: jest.fn(),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

const mockSupabase = require('../../supabase').supabase;

describe('projectService Unit Tests (Mock-based)', () => {
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    owner_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Project',
    color: 'sky' as const,
    is_general: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockProjectUser = {
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    role: 'member' as const,
    joined_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should successfully create a new project', async () => {
      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockProject,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.createProject(
        '550e8400-e29b-41d4-a716-446655440001',
        'Test Project'
      );

      expect(result).toEqual(mockProject);
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.insert).toHaveBeenCalledWith({
        owner_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Project',
        is_general: false,
      });
    });

    it('should handle creation errors', async () => {
      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Creation failed' },
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.createProject('550e8400-e29b-41d4-a716-446655440001', 'Test Project')
      ).rejects.toThrow('Failed to create project: Creation failed');
    });

    it('should validate created project data with Zod schema', async () => {
      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockProject,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.createProject(
        '550e8400-e29b-41d4-a716-446655440001',
        'Test Project'
      );

      // Should not throw validation error
      expect(() => ProjectSchema.parse(result)).not.toThrow();
      expect(result).toEqual(mockProject);
    });
  });

  describe('getProjectsForUser', () => {
    it('should successfully fetch projects for user as owner', async () => {
      const mockProjectWithRole = {
        ...mockProject,
        project_users: [{ role: 'owner' }],
      };

      const mockChain = {
        select: jest.fn(() => ({
          or: jest.fn().mockResolvedValue({
            data: [mockProjectWithRole],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectsForUser('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockProject.id,
        name: mockProject.name,
        userRole: 'owner',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
    });

    it('should successfully fetch projects for user as member', async () => {
      const memberProject = {
        ...mockProject,
        owner_id: '550e8400-e29b-41d4-a716-446655440999', // Different owner
        project_users: [{ role: 'admin' }],
      };

      const mockChain = {
        select: jest.fn(() => ({
          or: jest.fn().mockResolvedValue({
            data: [memberProject],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectsForUser('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toHaveLength(1);
      expect(result[0].userRole).toBe('admin');
    });

    it('should return empty array when user has no projects', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          or: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectsForUser('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          or: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.getProjectsForUser('550e8400-e29b-41d4-a716-446655440001')
      ).rejects.toThrow('Failed to fetch projects for user: Database error');
    });
  });

  describe('getProjectById', () => {
    it('should successfully fetch a project by ID', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockProject,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockProject);
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
    });

    it('should throw error when project not found', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.getProjectById('550e8400-e29b-41d4-a716-446655440999')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    it('should successfully update project name', async () => {
      const updatedProject = {
        ...mockProject,
        name: 'Updated Project Name',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: updatedProject,
                error: null,
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.updateProject(
        '550e8400-e29b-41d4-a716-446655440000',
        { name: 'Updated Project Name' }
      );

      expect(result).toEqual(updatedProject);
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Project Name',
          updated_at: expect.any(String),
        })
      );
    });

    it('should handle update errors', async () => {
      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' },
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.updateProject('550e8400-e29b-41d4-a716-446655440000', { name: 'New Name' })
      ).rejects.toThrow('Failed to update project: Update failed');
    });
  });

  describe('deleteProject', () => {
    it('should successfully delete a project', async () => {
      const mockChain = {
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.deleteProject('550e8400-e29b-41d4-a716-446655440000')
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.delete).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      const mockChain = {
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Delete failed' },
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.deleteProject('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Failed to delete project: Delete failed');
    });
  });

  describe('getProjectMembers', () => {
    it('should successfully fetch project members', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: [mockProjectUser],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectMembers('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual([mockProjectUser]);
      expect(mockSupabase.from).toHaveBeenCalledWith('project_users');
    });

    it('should return empty array when project has no members', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectMembers('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual([]);
    });

    it('should validate member data with Zod schema', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: [mockProjectUser],
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectMembers('550e8400-e29b-41d4-a716-446655440000');

      // Should not throw validation error
      result.forEach(member => {
        expect(() => ProjectUserSchema.parse(member)).not.toThrow();
      });
    });
  });

  describe('addProjectMember', () => {
    it('should successfully add a project member', async () => {
      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockProjectUser,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.addProjectMember(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440002',
        'admin'
      );

      expect(result).toEqual(mockProjectUser);
      expect(mockChain.insert).toHaveBeenCalledWith({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        role: 'admin',
      });
    });

    it('should use default role when not specified', async () => {
      const memberWithDefaultRole = { ...mockProjectUser, role: 'member' as const };

      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: memberWithDefaultRole,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.addProjectMember(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440002'
      );

      expect(result.role).toBe('member');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      );
    });

    it('should handle add member errors', async () => {
      const mockChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User already member' },
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.addProjectMember(
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002'
        )
      ).rejects.toThrow('Failed to add project member: User already member');
    });
  });

  describe('removeProjectMember', () => {
    it('should successfully remove a project member', async () => {
      const mockChain = {
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.removeProjectMember(
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002'
        )
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('project_users');
      expect(mockChain.delete).toHaveBeenCalled();
    });

    it('should handle remove member errors', async () => {
      const mockChain = {
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              error: { message: 'Member not found' },
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.removeProjectMember(
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002'
        )
      ).rejects.toThrow('Failed to remove project member: Member not found');
    });
  });

  describe('updateMemberRole', () => {
    it('should successfully update member role', async () => {
      const updatedMember = { ...mockProjectUser, role: 'admin' as const };

      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: updatedMember,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.updateMemberRole(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440002',
        'admin'
      );

      expect(result).toEqual(updatedMember);
      expect(mockChain.update).toHaveBeenCalledWith({ role: 'admin' });
    });

    it('should handle update role errors', async () => {
      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Role update failed' },
                }),
              })),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        projectService.updateMemberRole(
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002',
          'admin'
        )
      ).rejects.toThrow('Failed to update member role: Role update failed');
    });

    it('should validate updated member data with Zod schema', async () => {
      const updatedMember = { ...mockProjectUser, role: 'viewer' as const };

      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: updatedMember,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.updateMemberRole(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440002',
        'viewer'
      );

      // Should not throw validation error
      expect(() => ProjectUserSchema.parse(result)).not.toThrow();
      expect(result.role).toBe('viewer');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle projects with different member roles correctly', async () => {
      const projectsData = [
        {
          ...mockProject,
          id: '550e8400-e29b-41d4-a716-446655440100',
          name: 'Owner Project',
          owner_id: '550e8400-e29b-41d4-a716-446655440001', // User is owner
          project_users: [],
        },
        {
          ...mockProject,
          id: '550e8400-e29b-41d4-a716-446655440101',
          name: 'Member Project',
          owner_id: '550e8400-e29b-41d4-a716-446655440999', // Different owner
          project_users: [{ role: 'member' }],
        },
        {
          ...mockProject,
          id: '550e8400-e29b-41d4-a716-446655440102',
          name: 'Admin Project',
          owner_id: '550e8400-e29b-41d4-a716-446655440999', // Different owner
          project_users: [{ role: 'admin' }],
        },
      ];

      const mockChain = {
        select: jest.fn(() => ({
          or: jest.fn().mockResolvedValue({
            data: projectsData,
            error: null,
          }),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await projectService.getProjectsForUser('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toHaveLength(3);
      expect(result[0].userRole).toBe('owner');
      expect(result[1].userRole).toBe('member');
      expect(result[2].userRole).toBe('admin');
    });

    it('should handle valid role enumeration', async () => {
      const validRoles = ['admin', 'member', 'viewer'] as const;

      for (const role of validRoles) {
        const memberWithRole = { ...mockProjectUser, role };

        const mockChain = {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: memberWithRole,
                error: null,
              }),
            })),
          })),
        };

        mockSupabase.from.mockReturnValue(mockChain);

        const result = await projectService.addProjectMember(
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002',
          role
        );

        expect(result.role).toBe(role);
        // Should validate against Zod schema
        expect(() => ProjectUserSchema.parse(result)).not.toThrow();
      }
    });
  });
});