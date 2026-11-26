import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';

import { randomUUID } from 'node:crypto';

// ==========================================
// MOCK GEMINI SDK
// ==========================================

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = {
        generateContent,
      };
    }
  },
}));

// ==========================================
// TEST FIXTURES
// ==========================================

const aliceId = randomUUID();
const bobId = randomUUID();
const unknownId = randomUUID();

const activeTaskId = randomUUID();
const completedTaskId = randomUUID();
const secondTaskId = randomUUID();

const members = [
  {
    id: aliceId,
    name: 'Alice Carter',
    activeTasks: 2,
    inProgressTasks: 0,
    highPriorityTasks: 0,
    overdueTasks: 0,
  },
  {
    id: bobId,
    name: 'Bob Mehta',
    activeTasks: 2,
    inProgressTasks: 2,
    highPriorityTasks: 1,
    overdueTasks: 0,
  },
];

const tasks = [
  {
    id: activeTaskId,
    title: 'Develop Login Page',
    status: 'todo',
    priority: 'medium',
    assignee_id: aliceId,
  },
  {
    id: completedTaskId,
    title: 'Finalize Pricing',
    status: 'done',
    priority: 'low',
    assignee_id: aliceId,
  },
  {
    id: secondTaskId,
    title: 'API Integration',
    status: 'in_progress',
    priority: 'high',
    assignee_id: bobId,
  },
];

const plannerInput = {
  projectName: 'Product Launch',
  projectDescription: 'Launch version one',
  prompt: 'Generate useful project tasks',
  existingTasks: tasks,
  members,
  currentDate: '2026-11-26',
  mode: 'natural',
};

const projectInput = {
  projectName: 'Product Launch',
  projectDescription: 'Launch version one',
  statistics: {
    total: 3,
    completed: 1,
    completionRate: 33,
    overdue: 0,
  },
  tasks,
  members,
  activities: [],
  currentDate: '2026-11-26',
};

function mockJSON(data) {
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify(data),
  });
}

function apiError(status) {
  return Object.assign(
    new Error(`Mock API error ${status}`),
    { status }
  );
}

function suggestedTask(title, extra = {}) {
  return {
    title,
    description: 'Suggested project work',
    priority: 'medium',
    dueDate: null,
    assigneeId: null,
    ...extra,
  };
}

function plannerResponse(taskList = []) {
  return {
    overview: 'Generated task suggestions',
    tasks: taskList,
  };
}

// ==========================================
// SERVICE TESTS
// ==========================================

describe('Pulse AI Service', () => {

  let service;

  beforeAll(async () => {

    // Fake configuration for mocked requests.
    // No actual Gemini API calls are made.

    vi.stubEnv('GEMINI_API_KEY', 'mock-test-key');

    vi.stubEnv(
      'GEMINI_MODEL',
      'mock-primary-model'
    );

    vi.stubEnv(
      'GEMINI_FALLBACK_MODEL',
      'mock-fallback-model'
    );

    vi.stubEnv('GEMINI_TIMEOUT_MS', '5000');

    service = await import(
      '../src/services/ai.js'
    );

  });

  beforeEach(() => {

    generateContent.mockReset();

  });

  afterEach(() => {

    vi.useRealTimers();

  });

  afterAll(() => {

    vi.unstubAllEnvs();

  });

  // ==========================================
  // TEST 1: DUPLICATE TASK FILTERING
  // ==========================================

  it('filters existing and repeated task titles', async () => {

    mockJSON(plannerResponse([
      suggestedTask('Develop Login Page'),
      suggestedTask('  DEVELOP   LOGIN PAGE  '),
      suggestedTask('Write API Documentation'),
      suggestedTask('write api documentation'),
    ]));

    const result = await service.generateTasks(
      plannerInput
    );

    expect(result.tasks).toHaveLength(1);

    expect(result.tasks[0].title).toBe(
      'Write API Documentation'
    );

    expect(result.duplicatesSkipped).toBe(3);

  });

  // ==========================================
  // TEST 2: INVALID ASSIGNEE
  // ==========================================

  it('removes assignee IDs outside the project', async () => {

    mockJSON(plannerResponse([
      suggestedTask('Prepare Documentation', {
        assigneeId: unknownId,
      }),
    ]));

    const result = await service.generateTasks(
      plannerInput
    );

    expect(result.tasks[0].assigneeId).toBeNull();

  });

  // ==========================================
  // TEST 3: VALID ASSIGNEE AND DEADLINE
  // ==========================================

  it('preserves valid assignee IDs and deadlines', async () => {

    mockJSON(plannerResponse([
      suggestedTask('Fix Payment Bug', {
        priority: 'high',
        assigneeId: aliceId,
        dueDate: '2026-11-27',
      }),
    ]));

    const result = await service.generateTasks({
      ...plannerInput,
      prompt: 'Alice must fix the payment bug tomorrow',
    });

    expect(result.tasks[0]).toMatchObject({
      title: 'Fix Payment Bug',
      priority: 'high',
      assigneeId: aliceId,
      dueDate: '2026-11-27',
    });

  });

  // ==========================================
  // TEST 4: SAFE SUGGESTION WORDING
  // ==========================================

  it('does not claim that suggested tasks were saved', async () => {

    mockJSON({
      overview: 'Tasks have been created successfully.',
      tasks: [
        suggestedTask('Review Security'),
      ],
    });

    const result = await service.generateTasks(
      plannerInput
    );

    expect(result.overview).toBe(
      '1 task suggestion ready for your review and approval. No tasks have been saved.'
    );

  });

  // ==========================================
  // TEST 5: EMPTY SUGGESTIONS
  // ==========================================

  it('handles empty meeting action items', async () => {

    mockJSON(plannerResponse([]));

    const result = await service.generateTasks({
      ...plannerInput,
      mode: 'meeting',
      prompt: 'The team discussed general progress.',
    });

    expect(result.tasks).toEqual([]);

    expect(result.duplicatesSkipped).toBe(0);

    expect(result.overview).toBe(
      'No new task suggestions were generated.'
    );

  });

  // ==========================================
  // TEST 6: INVALID PLANNING MODE
  // ==========================================

  it('rejects unsupported planning modes before calling Gemini', async () => {

    await expect(
      service.generateTasks({
        ...plannerInput,
        mode: 'unsupported',
      })
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(generateContent).not.toHaveBeenCalled();

  });

  // ==========================================
  // TEST 7: INVALID DEADLINE FORMAT
  // ==========================================

  it('rejects invalid generated deadlines', async () => {

    mockJSON(plannerResponse([
      suggestedTask('Fix API Bug', {
        dueDate: 'tomorrow',
      }),
    ]));

    await expect(
      service.generateTasks(plannerInput)
    ).rejects.toMatchObject({
      status: 502,
    });

  });

  // ==========================================
  // TEST 8: PRIORITY SUGGESTION VALIDATION
  // ==========================================

  it('filters invalid, completed, unchanged and duplicate priority suggestions', async () => {

    mockJSON({
      summary: 'Project progress summary',
      achievements: [],
      risks: [],
      recommendations: [],
      prioritySuggestions: [
        {
          taskId: unknownId,
          suggestedPriority: 'high',
          reason: 'Unknown task',
        },
        {
          taskId: completedTaskId,
          suggestedPriority: 'high',
          reason: 'Completed task',
        },
        {
          taskId: secondTaskId,
          suggestedPriority: 'high',
          reason: 'Unchanged priority',
        },
        {
          taskId: activeTaskId,
          suggestedPriority: 'high',
          reason: 'Needs attention',
        },
        {
          taskId: activeTaskId,
          suggestedPriority: 'low',
          reason: 'Duplicate suggestion',
        },
      ],
    });

    const result = await service.summarizeProject(
      projectInput
    );

    expect(result.prioritySuggestions).toEqual([
      {
        taskId: activeTaskId,
        suggestedPriority: 'high',
        reason: 'Needs attention',
      },
    ]);

  });

  // ==========================================
  // TEST 9: RELATED TASK ID VALIDATION
  // ==========================================

  it('filters unknown and duplicate related task IDs', async () => {

    mockJSON({
      answer: 'Review the active tasks.',
      relatedTaskIds: [
        activeTaskId,
        unknownId,
        activeTaskId,
        secondTaskId,
      ],
      suggestedActions: [],
    });

    const result = await service.askProjectAI({
      ...projectInput,
      question: 'What should we focus on?',
    });

    expect(result.relatedTaskIds).toEqual([
      activeTaskId,
      secondTaskId,
    ]);

  });

  // ==========================================
  // TEST 10: BALANCED WORKLOAD
  // ==========================================

  it('retains the current assignee when workload is balanced', async () => {

    mockJSON({
      recommendedMemberId: aliceId,
      reason: 'The workload is already balanced.',
    });

    const result = await service.recommendAssignee({
      task: tasks[0],
      members,
    });

    expect(result.recommendedMemberId).toBe(
      aliceId
    );

    expect(result.retainsCurrentAssignment).toBe(
      true
    );

    expect(result.workloadGap).toBe(0);

    expect(
      result.projectedWorkloads.map(
        member => member.activeTasks
      )
    ).toEqual([2, 2]);

  });

  // ==========================================
  // TEST 11: UNSUITABLE AI RECOMMENDATION
  // ==========================================

  it('overrides an unbalanced AI assignment recommendation', async () => {

    mockJSON({
      recommendedMemberId: bobId,
      reason: 'Assign the task to Bob.',
    });

    const result = await service.recommendAssignee({
      task: tasks[0],
      members,
    });

    expect(result.recommendedMemberId).toBe(
      aliceId
    );

    expect(result.workloadGap).toBe(0);

    expect(result.aiExplanation).toBeNull();

  });

  // ==========================================
  // TEST 12: UNKNOWN AI MEMBER
  // ==========================================

  it('prevents recommendations of unknown members', async () => {

    mockJSON({
      recommendedMemberId: unknownId,
      reason: 'Assign to an unknown member.',
    });

    const result = await service.recommendAssignee({
      task: tasks[0],
      members,
    });

    expect(result.recommendedMemberId).toBe(
      aliceId
    );

    expect(result.aiExplanation).toBeNull();

  });

  // ==========================================
  // TEST 13: UNBALANCED TEAM
  // ==========================================

  it('recommends reassignment when it improves workload balance', async () => {

    mockJSON({
      recommendedMemberId: bobId,
      reason: 'Bob has fewer active tasks.',
    });

    const result = await service.recommendAssignee({
      task: tasks[0],
      members: [
        {
          ...members[0],
          activeTasks: 4,
        },
        {
          ...members[1],
          activeTasks: 0,
        },
      ],
    });

    expect(result.recommendedMemberId).toBe(
      bobId
    );

    expect(result.retainsCurrentAssignment).toBe(
      false
    );

    expect(result.workloadGap).toBe(2);

    expect(
      result.projectedWorkloads.map(
        member => member.activeTasks
      )
    ).toEqual([3, 1]);

  });

  // ==========================================
  // TEST 14: MALFORMED JSON
  // ==========================================

  it('returns a controlled error for malformed JSON', async () => {

    generateContent.mockResolvedValueOnce({
      text: 'This is not valid JSON',
    });

    await expect(
      service.generateTasks(plannerInput)
    ).rejects.toMatchObject({
      status: 502,
    });

  });

  // ==========================================
  // TEST 15: INVALID RESPONSE SCHEMA
  // ==========================================

  it('rejects generated responses with invalid priorities', async () => {

    mockJSON(plannerResponse([
      suggestedTask('Review Deployment', {
        priority: 'critical',
      }),
    ]));

    await expect(
      service.generateTasks(plannerInput)
    ).rejects.toMatchObject({
      status: 502,
    });

  });

  // ==========================================
  // TEST 16: RATE LIMIT FALLBACK
  // ==========================================

  it('switches to the fallback model after a rate limit error', async () => {

    generateContent.mockRejectedValueOnce(
      apiError(429)
    );

    mockJSON(plannerResponse([
      suggestedTask('Prepare Deployment'),
    ]));

    const result = await service.generateTasks(
      plannerInput
    );

    expect(result.tasks).toHaveLength(1);

    expect(generateContent).toHaveBeenCalledTimes(2);

    expect(
      generateContent.mock.calls[0][0].model
    ).toBe('mock-primary-model');

    expect(
      generateContent.mock.calls[1][0].model
    ).toBe('mock-fallback-model');

  });

  // ==========================================
  // TEST 17: BOTH MODELS RATE LIMITED
  // ==========================================

  it('returns a controlled error when both models are rate limited', async () => {

    generateContent.mockRejectedValue(
      apiError(429)
    );

    await expect(
      service.generateTasks(plannerInput)
    ).rejects.toMatchObject({
      status: 429,
    });

    expect(generateContent).toHaveBeenCalledTimes(2);

  });

  // ==========================================
  // TEST 18: TEMPORARY SERVICE FAILURE
  // ==========================================

  it('retries temporary Gemini service failures', async () => {

    vi.useFakeTimers();

    generateContent.mockRejectedValueOnce(
      apiError(503)
    );

    mockJSON(plannerResponse([
      suggestedTask('Review Production Logs'),
    ]));

    const pending = service.generateTasks(
      plannerInput
    );

    const assertion = expect(
      pending
    ).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          title: 'Review Production Logs',
        }),
      ],
    });

    await vi.runAllTimersAsync();

    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(2);

    expect(
      generateContent.mock.calls[1][0].model
    ).toBe('mock-primary-model');

  });

  // ==========================================
  // TEST 19: REQUEST TIMEOUT
  // ==========================================

  it('returns a controlled timeout error for stalled requests', async () => {

    vi.useFakeTimers();

    generateContent.mockImplementation(
      () => new Promise(() => {})
    );

    const pending = service.generateTasks(
      plannerInput
    );

    const assertion = expect(
      pending
    ).rejects.toMatchObject({
      status: 504,
    });

    await vi.advanceTimersByTimeAsync(5001);

    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(1);

    expect(
      generateContent.mock.calls[0][0]
        .config.abortSignal.aborted
    ).toBe(true);

  });

  // ==========================================
  // TEST 20: OVERSIZED PROJECT CONTEXT
  // ==========================================

  it('rejects oversized project context before calling Gemini', async () => {

    await expect(
      service.generateTasks({
        ...plannerInput,
        projectDescription: 'x'.repeat(61000),
      })
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(generateContent).not.toHaveBeenCalled();

  });

});