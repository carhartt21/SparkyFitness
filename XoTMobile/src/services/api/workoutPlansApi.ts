import { apiFetch } from './apiClient';
import type { WorkoutPlanTemplate } from '../../types/workoutPlans';

export const fetchActiveWorkoutPlans = async (
  date: string
): Promise<WorkoutPlanTemplate[]> => {
  const response = await apiFetch<
    WorkoutPlanTemplate[] | WorkoutPlanTemplate | null
  >({
    endpoint: `/api/workout-plan-templates/active/${date}`,
    serviceName: 'Workout Plans API',
    operation: 'fetch active workout plans',
  });
  if (!response) return [];
  return Array.isArray(response) ? response : [response];
};

export type WorkoutPlanWrite = Omit<
  WorkoutPlanTemplate,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;
export const fetchWorkoutPlans = () =>
  apiFetch<WorkoutPlanTemplate[]>({
    endpoint: '/api/workout-plan-templates',
    serviceName: 'Workout Plans API',
    operation: 'list plans',
  });
export const saveWorkoutPlan = (data: WorkoutPlanWrite, id?: string) =>
  apiFetch<WorkoutPlanTemplate>({
    endpoint: `/api/workout-plan-templates${id ? `/${id}` : ''}`,
    method: id ? 'PUT' : 'POST',
    body: data,
    serviceName: 'Workout Plans API',
    operation: 'save plan',
  });
export const deleteWorkoutPlan = (id: string) =>
  apiFetch<{ message: string }>({
    endpoint: `/api/workout-plan-templates/${id}`,
    method: 'DELETE',
    serviceName: 'Workout Plans API',
    operation: 'delete plan',
  });
export const prepareActivityExercise = (
  planId: string,
  assignmentId: string,
  name: string
) =>
  apiFetch<{ exercise_id: string }>({
    endpoint: `/api/workout-plan-templates/${planId}/assignments/${assignmentId}/activity-exercise`,
    method: 'POST',
    body: { name },
    serviceName: 'Workout Plans API',
    operation: 'prepare activity',
  });
