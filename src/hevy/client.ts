import {
  HevyConfig,
  Workout,
  CreateWorkoutInput,
  UpdateWorkoutInput,
  WorkoutCountResponse,
  WorkoutEvent,
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  ExerciseTemplate,
  ExerciseHistoryEntry,
  ExerciseHistoryParams,
  CreateCustomExerciseInput,
  RoutineFolder,
  CreateFolderInput,
  BodyMeasurement,
  CreateBodyMeasurementInput,
  UpdateBodyMeasurementInput,
  UserInfo,
  PaginationParams,
  WorkoutQueryParams,
  WorkoutEventsParams,
} from './types.js';

export class HevyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: HevyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.hevyapp.com';
  }

  /**
   * Clean payload by removing only undefined values.
   * Keeps null values as they are semantically meaningful to the API
   * (e.g., folder_id: null means "no folder" / default folder).
   */
  private cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create abort controller for timeout (60 seconds for API requests)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.text();
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorBody);
            // Extract error message from common API error formats
            errorMessage = errorJson.error?.message ||
                          errorJson.message ||
                          errorJson.error ||
                          JSON.stringify(errorJson);
          } catch {
            // If not JSON, use the text as is
            errorMessage = errorBody || errorMessage;
          }
        } catch {
          // If we can't read the body, just use statusText
        }

        throw new Error(
          `Hevy API error (${response.status}): ${errorMessage}`
        );
      }

      // Some endpoints (PUT body_measurements) return 200 with empty body
      const text = await response.text();
      if (!text) {
        return undefined as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Hevy API request timed out');
        }
        throw error;
      }
      throw new Error(`Hevy API request failed: ${String(error)}`);
    }
  }

  // ===== Workout Methods =====

  async getWorkouts(params: WorkoutQueryParams = {}): Promise<Workout[]> {
    const { page = 0, pageSize = 10, startDate, endDate } = params;

    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (startDate) {
      queryParams.append('startDate', startDate);
    }
    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const endpoint = `/v1/workouts?${queryParams.toString()}`;
    const response = await this.request<{ workouts: Workout[] }>(endpoint);
    return response.workouts || [];
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.request<Workout>(`/v1/workouts/${encodeURIComponent(id)}`);
  }

  async createWorkout(data: CreateWorkoutInput): Promise<Workout> {
    const response = await this.request<{ workout: Workout[] }>('/v1/workouts', {
      method: 'POST',
      body: JSON.stringify({ workout: this.cleanPayload(data) }),
    });
    // API returns { workout: [{ ... }] }, extract first element
    return response.workout[0];
  }

  async updateWorkout(id: string, data: UpdateWorkoutInput): Promise<Workout> {
    const response = await this.request<{ workout: Workout[] }>(`/v1/workouts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ workout: this.cleanPayload(data) }),
    });
    // API returns { workout: [{ ... }] }, extract first element
    return response.workout[0];
  }

  async getWorkoutCount(): Promise<WorkoutCountResponse> {
    return this.request<WorkoutCountResponse>('/v1/workouts/count');
  }

  async getWorkoutEvents(params: WorkoutEventsParams): Promise<WorkoutEvent[]> {
    const { since, page = 1, pageSize = 5 } = params;
    const queryParams = new URLSearchParams({
      since,
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ events: WorkoutEvent[] }>(
      `/v1/workouts/events?${queryParams.toString()}`
    );
    return response.events || [];
  }

  // ===== Routine Methods =====

  async getRoutines(params: PaginationParams = {}): Promise<Routine[]> {
    const { page = 0, pageSize = 50 } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ routines: Routine[] }>(
      `/v1/routines?${queryParams.toString()}`
    );
    return response.routines || [];
  }

  async getRoutine(id: string): Promise<Routine> {
    return this.request<Routine>(`/v1/routines/${encodeURIComponent(id)}`);
  }

  async createRoutine(data: CreateRoutineInput): Promise<Routine> {
    const response = await this.request<{ routine: Routine[] }>('/v1/routines', {
      method: 'POST',
      body: JSON.stringify({ routine: this.cleanPayload(data) }),
    });
    // API returns { routine: [{ ... }] }, extract first element
    return response.routine[0];
  }

  async updateRoutine(id: string, data: UpdateRoutineInput): Promise<Routine> {
    // Hevy's PUT /v1/routines/{id} rejects folder_id (the field is only accepted on create).
    // Strip it before sending — folder changes must be done in-app.
    const { folder_id, ...rest } = data;
    const response = await this.request<{ routine: Routine[] }>(`/v1/routines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ routine: this.cleanPayload(rest) }),
    });
    // API returns { routine: [{ ... }] }, extract first element
    return response.routine[0];
  }

  // NOTE: Hevy's public API does not currently expose DELETE for workouts or routines.
  // Deletion can only be done in the Hevy app.

  // ===== Exercise Template Methods =====

  async getExerciseTemplates(params: PaginationParams = {}): Promise<ExerciseTemplate[]> {
    const { page = 0, pageSize = 50 } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ exercise_templates: ExerciseTemplate[] }>(
      `/v1/exercise_templates?${queryParams.toString()}`
    );
    return response.exercise_templates || [];
  }

  async getExerciseTemplate(id: string): Promise<ExerciseTemplate> {
    return this.request<ExerciseTemplate>(`/v1/exercise_templates/${encodeURIComponent(id)}`);
  }

  async createCustomExerciseTemplate(
    data: CreateCustomExerciseInput
  ): Promise<{ id: number | string }> {
    return this.request<{ id: number | string }>('/v1/exercise_templates', {
      method: 'POST',
      body: JSON.stringify({ exercise: this.cleanPayload(data) }),
    });
  }

  // ===== Exercise History =====

  async getExerciseHistory(
    params: ExerciseHistoryParams
  ): Promise<ExerciseHistoryEntry[]> {
    const { exercise_template_id, start_date, end_date } = params;
    const queryParams = new URLSearchParams();
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);

    const qs = queryParams.toString();
    const endpoint =
      `/v1/exercise_history/${encodeURIComponent(exercise_template_id)}` +
      (qs ? `?${qs}` : '');
    const response = await this.request<{ exercise_history: ExerciseHistoryEntry[] }>(
      endpoint
    );
    return response.exercise_history || [];
  }

  // ===== Routine Folder Methods =====

  async getRoutineFolders(): Promise<RoutineFolder[]> {
    const response = await this.request<{ routine_folders: RoutineFolder[]; folders?: RoutineFolder[] }>(
      '/v1/routine_folders'
    );
    return response.routine_folders || response.folders || [];
  }

  async getRoutineFolder(id: string): Promise<RoutineFolder> {
    const response = await this.request<{ routine_folder?: RoutineFolder } | RoutineFolder>(
      `/v1/routine_folders/${encodeURIComponent(id)}`
    );
    // Hevy may return the folder either bare or wrapped in { routine_folder: ... }
    if (response && typeof response === 'object' && 'routine_folder' in response && response.routine_folder) {
      return response.routine_folder;
    }
    return response as RoutineFolder;
  }

  async createRoutineFolder(data: CreateFolderInput): Promise<RoutineFolder> {
    const response = await this.request<{ routine_folder: RoutineFolder }>('/v1/routine_folders', {
      method: 'POST',
      body: JSON.stringify({ routine_folder: this.cleanPayload(data) }),
    });
    return response.routine_folder;
  }

  // NOTE: Hevy's public API does not currently expose PUT or DELETE for routine folders.

  // ===== Body Measurement Methods =====

  async getBodyMeasurements(
    params: PaginationParams = {}
  ): Promise<BodyMeasurement[]> {
    const { page = 1, pageSize = 10 } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ body_measurements: BodyMeasurement[] }>(
      `/v1/body_measurements?${queryParams.toString()}`
    );
    return response.body_measurements || [];
  }

  async getBodyMeasurement(date: string): Promise<BodyMeasurement> {
    return this.request<BodyMeasurement>(
      `/v1/body_measurements/${encodeURIComponent(date)}`
    );
  }

  async createBodyMeasurement(
    data: CreateBodyMeasurementInput
  ): Promise<void> {
    await this.request<void>('/v1/body_measurements', {
      method: 'POST',
      body: JSON.stringify(this.cleanPayload(data)),
    });
  }

  async updateBodyMeasurement(
    date: string,
    data: UpdateBodyMeasurementInput
  ): Promise<void> {
    await this.request<void>(
      `/v1/body_measurements/${encodeURIComponent(date)}`,
      {
        method: 'PUT',
        body: JSON.stringify(this.cleanPayload(data)),
      }
    );
  }

  // ===== User Methods =====

  async getUserInfo(): Promise<UserInfo> {
    const response = await this.request<{ data: UserInfo } | UserInfo>(
      '/v1/user/info'
    );
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return (response as { data: UserInfo }).data;
    }
    return response as UserInfo;
  }
}
