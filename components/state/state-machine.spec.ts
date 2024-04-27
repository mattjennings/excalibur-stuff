import * as ex from 'excalibur'
import { ExitStateEvent, State, StateMachineComponent } from './state-machine'

interface TestMachine {
  owner: ex.Entity
  states: 'idle' | 'walk'
  payloads: {
    walk: {
      foo: string
    }
  }
}

describe('inline state definition', () => {
  test('sets initial state', () => {
    const state = new StateMachineComponent({
      initialState: 'idle',
      states: {
        idle: {},
      },
    })

    expect(state.current.id).toBe('idle')
  })

  test('transitions to next state', () => {
    const state = new StateMachineComponent({
      initialState: 'idle',
      states: {
        idle: {
          transitions: {
            walk: 'walk',
          },
        },
        walk: {
          transitions: {
            idle: 'idle',
          },
        },
      },
    })

    state.transition('walk')

    expect(state.current.id).toBe('walk')
  })

  test('does not transition to next state if guard fails', () => {
    const guard = vi.fn(() => false)
    const state = new StateMachineComponent({
      initialState: 'idle',
      states: {
        idle: {
          transitions: {
            walk: {
              target: 'walk',
              guard,
            },
          },
        },
        walk: {
          transitions: {
            idle: 'idle',
          },
        },
      },
    })

    state.transition('walk')

    expect(guard).toHaveBeenCalled()
    expect(state.current.id).toBe('idle')
  })

  test('triggers exit and entry callbacks', () => {
    const onEnter = vi.fn()
    const onExit = vi.fn()

    const state = new StateMachineComponent<TestMachine>({
      initialState: 'idle',
      states: {
        idle: {
          onExit,
          transitions: {
            walk: 'walk',
          },
        },
        walk: {
          onEnter,
          transitions: {
            idle: {
              target: 'idle',
            },
          },
        },
      },
    })

    state.transition('walk', { foo: 'bar' })

    expect(onExit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { foo: 'bar' } }),
    )
    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { foo: 'bar' } }),
    )
  })

  test('triggers post and pre update callbacks', () => {
    const onPreUpdate = vi.fn()
    const onPostUpdate = vi.fn()

    const owner = new ex.Actor()

    const state = new StateMachineComponent<TestMachine>({
      initialState: 'walk',
      states: {
        idle: {},
        walk: {
          onPreUpdate,
          onPostUpdate,
        },
      },
    })

    owner.addComponent(state)

    const updateEvent = {
      delta: 0,
      engine: {} as ex.Engine,
      owner,
      context: {},
    }
    owner.emit(
      'preupdate',
      new ex.PreUpdateEvent(
        updateEvent.engine,
        updateEvent.delta,
        updateEvent.owner,
      ),
    )
    owner.emit(
      'postupdate',
      new ex.PostUpdateEvent(
        updateEvent.engine,
        updateEvent.delta,
        updateEvent.owner,
      ),
    )

    expect(onPreUpdate).toHaveBeenCalledWith(updateEvent)
    expect(onPostUpdate).toHaveBeenCalledWith(updateEvent)
  })
})

describe('class state definitions', () => {
  test('sets initial state', () => {
    class IdleState extends State<TestMachine, 'idle'> {
      constructor() {
        super({})
      }
    }

    const state = new StateMachineComponent({
      initialState: 'idle',
      states: {
        idle: new IdleState(),
      },
    })

    expect(state.current.id).toBe('idle')
    expect(state.current).toBeInstanceOf(IdleState)
  })

  test('triggers exit and entry callbacks', () => {
    const onEnter = vi.fn()
    const onExit = vi.fn()

    class IdleState extends State<TestMachine, 'idle'> {
      constructor() {
        super({
          transitions: {
            walk: 'walk',
          },
        })
      }

      onExit(ev: ExitStateEvent<TestMachine>): void {
        onExit(ev)
      }
    }

    class WalkState extends State<TestMachine, 'walk'> {
      constructor() {
        super({
          transitions: {
            idle: 'idle',
          },
        })
      }

      onEnter(ev: ExitStateEvent<TestMachine>): void {
        onEnter(ev)
      }
    }

    const state = new StateMachineComponent<TestMachine>({
      initialState: 'idle',
      states: {
        idle: new IdleState(),
        walk: new WalkState(),
      },
    })

    state.transition('walk', { foo: 'bar' })

    expect(onExit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { foo: 'bar' } }),
    )
    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { foo: 'bar' } }),
    )
  })

  test('transitions using state method', () => {
    class IdleState extends State<TestMachine, 'idle'> {
      constructor() {
        super({
          transitions: {
            walk: 'walk',
          },
        })
      }
    }

    const idleState = new IdleState()
    const state = new StateMachineComponent({
      initialState: 'idle',
      states: {
        idle: idleState,
        walk: {},
      },
    })

    const owner = new ex.Actor()
    owner.addComponent(state)

    idleState.transition('walk', { foo: 'bar' })

    expect(state.current.id).toBe('walk')
  })
})

describe('context', () => {
  interface TestMachineContext {
    owner: ex.Entity
    states: 'idle' | 'walk'
    context: {
      isAttacking: boolean
    }
  }

  test('sets initial context', () => {
    const state = new StateMachineComponent<TestMachineContext>({
      initialState: 'idle',
      states: {
        idle: {},
        walk: {},
      },
      context: {
        isAttacking: false,
      },
    })

    expect(state.context.isAttacking).toBe(false)
  })

  test('sets updates context', () => {
    const state = new StateMachineComponent<TestMachineContext>({
      initialState: 'idle',
      states: {
        idle: {},
        walk: {},
      },
      context: {
        isAttacking: false,
      },
    })

    state.context.isAttacking = true

    expect(state.context.isAttacking).toBe(true)
  })
})

describe('events', () => {
  test('emits change event', () => {
    const transition = vi.fn()

    const state = new StateMachineComponent<TestMachine>({
      initialState: 'idle',
      states: {
        idle: {
          transitions: {
            walk: 'walk',
          },
        },
        walk: {
          transitions: {
            idle: 'idle',
          },
        },
      },
    })

    state.events.on('transition', transition)

    state.transition('walk', { foo: 'bar' })

    expect(transition).toHaveBeenCalledWith({
      payload: {
        foo: 'bar',
      },
      context: {},
      prevState: 'idle',
      nextState: 'walk',
    })
  })
})

describe('hierarchical state', () => {
  interface HierarchicalTestMachine {
    owner: ex.Entity
    states: 'idle' | 'walk' | 'walk.sad' | 'walk.happy'
  }

  test('navigates to sub state', () => {
    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'idle',
      states: {
        idle: {
          transitions: {
            'walk.happy': 'walk.happy',
          },
        },
        walk: {
          states: {
            happy: {},
            sad: {},
          },
        },
      },
    })

    state.transition('walk.happy')

    expect(state.current.id).toBe('walk.happy')
  })

  test('calls onEnter for sub state and parents in proper order', () => {
    let count = 0
    const walkOnEnter = vi.fn()
    const happyOnEnter = vi.fn()

    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'idle',
      states: {
        idle: {
          transitions: {
            'walk.happy': 'walk.happy',
          },
        },
        walk: {
          onEnter: () => walkOnEnter(count++),
          states: {
            happy: {
              onEnter: () => happyOnEnter(count++),
            },
            sad: {},
          },
        },
      },
    })

    state.transition('walk.happy')

    expect(walkOnEnter).toHaveBeenCalledWith(0)
    expect(happyOnEnter).toHaveBeenCalledWith(1)
  })

  test('does not call onEnter for parent state if switching to sibling state', () => {
    const walkOnEnter = vi.fn()
    const sadOnEnter = vi.fn()

    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'walk.happy',
      states: {
        idle: {},
        walk: {
          onEnter: walkOnEnter,
          states: {
            happy: {
              transitions: {
                'walk.sad': 'walk.sad',
              },
            },
            sad: {
              onEnter: sadOnEnter,
            },
          },
        },
      },
    })

    state.transition('walk.sad')

    expect(walkOnEnter).not.toHaveBeenCalled()
    expect(sadOnEnter).toHaveBeenCalled()
  })

  test('calls onExit for sub state and parents in proper order', () => {
    let count = 0
    const walkOnExit = vi.fn()
    const happyOnExit = vi.fn()

    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'walk.happy',
      states: {
        idle: {},
        walk: {
          onExit: () => walkOnExit(count++),
          states: {
            happy: {
              onExit: () => happyOnExit(count++),
              transitions: {
                idle: 'idle',
              },
            },
            sad: {},
          },
        },
      },
    })

    state.transition('idle')

    expect(happyOnExit).toHaveBeenCalledWith(0)
    expect(walkOnExit).toHaveBeenCalledWith(1)
  })

  test('does not call onExit for parent state if switching to sibling state', () => {
    const walkOnExit = vi.fn()
    const happyOnExit = vi.fn()

    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'walk.happy',
      states: {
        idle: {},
        walk: {
          onExit: walkOnExit,
          states: {
            happy: {
              onExit: happyOnExit,
              transitions: {
                'walk.sad': 'walk.sad',
              },
            },
            sad: {},
          },
        },
      },
    })

    state.transition('walk.sad')

    expect(walkOnExit).not.toHaveBeenCalled()
    expect(happyOnExit).toHaveBeenCalled()
  })

  test('calls update for sub state and parents in proper order', () => {
    let count = 0
    const walkPreUpdate = vi.fn()
    const happyPreUpdate = vi.fn()
    const walkPostUpdate = vi.fn()
    const happyPostUpdate = vi.fn()

    const owner = new ex.Actor()

    const state = new StateMachineComponent<HierarchicalTestMachine>({
      initialState: 'walk.happy',
      states: {
        idle: {},
        walk: {
          onPreUpdate: () => walkPreUpdate(count++),
          onPostUpdate: () => walkPostUpdate(count++),
          states: {
            happy: {
              onPreUpdate: () => happyPreUpdate(count++),
              onPostUpdate: () => happyPostUpdate(count++),
              transitions: {
                'walk.sad': 'walk.sad',
              },
            },
            sad: {},
          },
        },
      },
    })

    owner.addComponent(state)

    owner.emit('preupdate', {})
    owner.emit('postupdate', {})

    expect(walkPreUpdate).toHaveBeenCalledWith(0)
    expect(happyPreUpdate).toHaveBeenCalledWith(1)
    expect(walkPostUpdate).toHaveBeenCalledWith(2)
    expect(happyPostUpdate).toHaveBeenCalledWith(3)
  })
})
