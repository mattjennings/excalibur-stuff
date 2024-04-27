
import * as ex from 'excalibur'

interface StateMachineDefinition<
  TOwner extends ex.Entity,
  TState extends string,
  TPayloads extends PartialRecord<TState, unknown>,
  TContext extends Record<string, any> = {},
> {
  owner: TOwner
  states: TState
  payloads?: TPayloads
  context?: TContext
}

export class StateMachineComponent<
  TMachine extends StateMachineDefinition<
    ex.Entity,
    string,
    PartialRecord<string, unknown>
  >,
> extends ex.Component {
  declare owner: OwnerType<TMachine>
  debug?: { draw?: boolean; log?: boolean }
  states: {
    [key in ParentStateType<TMachine>]: State<any, key>
  }
  context: ContextType<TMachine>
  current: State<
    StateMachineDefinition<
      OwnerType<TMachine>,
      StateType<TMachine>,
      PayloadsType<TMachine>
    >,
    StateType<TMachine>
  >

  events = new ex.EventEmitter<{
    transition: (ev: EnterStateEvent<TMachine, StateType<TMachine>>) => void
  }>()

  constructor(args: {
    initialState: StateType<TMachine>
    context?: IsEmptyObject<ContextType<TMachine>> extends true
      ? never
      : ContextType<TMachine>
    states: {
      [key in ParentStateType<TMachine>]:
        | StateArgs<
            StateMachineDefinition<
              OwnerType<TMachine>,
              StateType<TMachine> | ParentStateType<TMachine>,
              PayloadsType<TMachine>
            >,
            key
          >
        | State<
            StateMachineDefinition<
              OwnerType<TMachine>,
              StateType<TMachine> | ParentStateType<TMachine>,
              PayloadsType<TMachine>
            >,
            key
          >
    }
    debug?: boolean | { draw?: boolean; log?: boolean }
  }) {
    super()

    const initStates = (states: typeof args.states, parent?: State<any, any>) =>
      Object.entries(states).reduce((acc, [id, stateOrDef]) => {
        let state: State<any, any>
        if (stateOrDef instanceof State) {
          state = stateOrDef
        } else {
          state = new State(stateOrDef as StateArgs<any, any>)
        }

        state.id = parent ? `${parent.id}.${id}` : id
        state.parent = parent
        state.context = this.context
        if (state.states) {
          state.states = initStates(state.states as any, state)
        }
        acc[state.id] = state
        return acc
      }, {} as any)

    this.context = args.context ?? ({} as ContextType<TMachine>)
    this.states = initStates(args.states)

    this.current = this.getState(args.initialState)

    if (args.debug) {
      if (args.debug === true) {
        this.debug = { draw: true, log: true }
      } else {
        this.debug = args.debug
      }
    }
  }

  onAdd(owner: OwnerType<TMachine>): void {
    for (const state of this.getAllStates()) {
      state.owner = owner
    }

    owner.on('preupdate', ({ engine, delta }) => {
      const ev = {
        owner,
        engine,
        delta,
        context: this.context,
      }
      this.getStateParents(this.current).forEach((state) => {
        state.onPreUpdate?.(ev)
      })
      this.current.onPreUpdate?.(ev)
    })

    owner.on('postupdate', ({ engine, delta }) => {
      const ev = {
        owner,
        engine,
        delta,
        context: this.context,
      }
      this.getStateParents(this.current).forEach((state) => {
        state.onPostUpdate?.(ev)
      })
      this.current.onPostUpdate?.(ev)
    })

    if (
      typeof this.debug === 'boolean' ? this.debug : this.debug?.draw === true
    ) {
      const label = new ex.Label({
        text: this.current.id.toUpperCase(),
        anchor: new ex.Vector(0.5, 0.5),
        pos: new ex.Vector(0, -40),
      })
      this.owner?.addChild(label)
      label.on('preupdate', () => {
        label.text = this.current.id.toUpperCase()
      })
    }
  }

  private getAllStates(states: Record<string, State<any, any>> = this.states) {
    return Object.values(states).reduce(
      (acc, state) => {
        acc.push(state)
        if (state.states) {
          acc.push(...this.getAllStates(state.states))
        }
        return acc
      },
      [] as State<any, any>[],
    )
  }

  /**
   * Returns true if the state machine is in one of the specified states
   * or a child of one of those states
   */
  is(...states: Array<StateType<TMachine> | ParentStateType<TMachine>>) {
    return states.some((state) => this.current.id.startsWith(state))
  }

  /**
   * Returns true if the state machine is in exactly one of the specified states
   */
  isExactly(...states: Array<StateType<TMachine> | ParentStateType<TMachine>>) {
    return states.includes(this.current.id)
  }

  transition<T extends StateType<TMachine>>(
    id: T,
    ...args: isUnknown<PayloadsType<TMachine>[T]> extends true
      ? []
      : isOptional<PayloadsType<TMachine>[T]> extends true
        ? [PayloadsType<TMachine>[T]?]
        : [PayloadsType<TMachine>[T]]
  ): void {
    const payload = args[0] as PayloadsType<TMachine>[T]

    const nextState = this.getState(id)
    const prevState = this.current
    const transition = this.getTransition(id, this.current)

    if (!transition) {
      if (nextState.id !== this.current.id) {
        console.warn(`No transition for "${id}" from "${this.current.id}"`)
      }
      return
    }

    const target =
      typeof transition === 'string' ? transition : transition.target

    const enterEvent: EnterStateEvent<
      StateMachineDefinition<
        OwnerType<TMachine>,
        StateType<TMachine>,
        PayloadsType<TMachine>
      >,
      // dont know how to type this properly. should be T
      any
    > = {
      owner: this.owner,
      payload: payload,
      nextState: id,
      prevState: prevState.id,
      context: this.context,
    }

    if (typeof transition === 'object' && transition.guard) {
      const guards = Array.isArray(transition.guard)
        ? transition.guard
        : [transition.guard]

      if (!guards.every((guard) => guard(enterEvent))) {
        return
      }
    }

    const currentParents = this.getStateParents(this.current)
    const nextStateParents = this.getStateParents(nextState)

    const exitEvent = {
      owner: this.owner,
      payload: payload as PayloadsType<TMachine>[T],
      nextState: id as T,
      prevState: prevState.id,
      context: this.context,
    }

    this.current.onExit?.(exitEvent)

    // call onExit on all parents (from current upward to root)
    for (let i = currentParents.length - 1; i >= 0; i--) {
      const parent = currentParents[i]
      if (!nextState.id.includes(parent.id)) {
        parent.onExit?.(exitEvent)
      }
    }

    if (
      typeof this.debug === 'boolean' ? this.debug : this.debug?.log === true
    ) {
      // just creates noise in tests
      if (import.meta.env.MODE !== 'test') {
        console.groupCollapsed(
          `[${this.owner!.name}] STATE CHANGE: ${target} FROM ${this.current.id}`,
        )
        console.trace()
        console.groupEnd()
      }
    }

    this.current = nextState
    // call onEnter on all parents (from root downward to current)
    nextStateParents.forEach((parent) => {
      if (!prevState.id.includes(parent.id)) {
        parent.onEnter?.(enterEvent)
      }
    })
    this.current.onEnter?.(enterEvent)

    this.events.emit('transition', enterEvent)
  }

  /**
   * Recursively looks through the states and returns the state with the given id
   */
  private getState(
    resolvedId: string,
    states: Record<string, State<any, any>> = this.states,
  ): State<any, any> {
    const [rootStateId, subStateId] = resolvedId.split('.')
    let state = states[resolvedId]

    if (!state && rootStateId in states) {
      if (subStateId) {
        try {
          state = this.getState(resolvedId, states[rootStateId].states)
        } catch (e) {
          // let error bubble up to first call so we have the full id path
        }
      }
    }

    if (!state) {
      throw new Error(`State "${resolvedId}" does not exist`)
    }

    return state
  }

  private getStateParents(state: State<any, any>) {
    const parents: State<any, any>[] = []

    let parent = state.parent

    while (parent) {
      parents.push(parent)
      parent = parent.parent
    }

    return parents
  }

  private getTransition(id: string, state: State<any, any>) {
    return state.transitions[id]
  }
}

export interface StateArgs<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  TStateId extends StateType<TMachine> | ParentStateType<TMachine>,
> {
  transitions?: Transitions<TMachine>
  states?: SubStates<TMachine, TStateId>

  onEnter?(
    ev: EnterStateEvent<
      TMachine,
      // State class may be a parent state type, in which case the target event
      // may be any of the child state types
      TStateId extends ParentStateType<TMachine>
        ? StateType<TMachine>
        : TStateId extends StateType<TMachine>
          ? TStateId
          : StateType<TMachine>
    >,
  ): void
  onExit?(ev: ExitStateEvent<TMachine>): void
  onPreUpdate?(ev: PreUpdateStateEvent<TMachine>): void
  onPostUpdate?(ev: PostUpdateStateEvent<TMachine>): void
}

export class State<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  TStateId extends StateType<TMachine> | ParentStateType<TMachine>,
> implements StateArgs<TMachine, TStateId>
{
  // assigned by StateMachineComponent
  declare id: TStateId
  declare owner: OwnerType<TMachine>

  transitions: Transitions<TMachine> = {}

  parent?: State<TMachine, any>
  states?: SubStates<TMachine, TStateId>

  context!: ContextType<TMachine> // assigned by state machine

  get machine() {
    return this.owner.get(
      StateMachineComponent,
    ) as StateMachineComponent<TMachine>
  }

  constructor(args: StateArgs<TMachine, TStateId>) {
    this.transitions = args.transitions ?? {}
    this.states = args.states

    this.onEnter = args.onEnter ?? this.onEnter
    this.onExit = args.onExit ?? this.onExit
    this.onPreUpdate = args.onPreUpdate ?? this.onPreUpdate
    this.onPostUpdate = args.onPostUpdate ?? this.onPostUpdate
  }

  onEnter(
    ev: EnterStateEvent<
      TMachine,
      TStateId extends ParentStateType<TMachine>
        ? SubStateType<TMachine, TStateId>
        : TStateId extends StateType<TMachine>
          ? TStateId
          : StateType<TMachine>
    >,
  ): void {}
  onExit(ev: ExitStateEvent<TMachine>): void {}
  onPreUpdate(ev: PreUpdateStateEvent<TMachine>): void {}
  onPostUpdate(ev: PostUpdateStateEvent<TMachine>): void {}

  transition<T extends StateType<TMachine>>(
    id: T,
    ...args: isUnknown<PayloadsType<TMachine>[T]> extends true
      ? []
      : isOptional<PayloadsType<TMachine>[T]> extends true
        ? [PayloadsType<TMachine>[T]?]
        : [PayloadsType<TMachine>[T]]
  ) {
    return this.machine.transition(id, ...args)
  }
}

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */
export type Transitions<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> = {
  [key in StateType<TMachine>]?: Transition<TMachine, key>
}

export type Transition<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  Target extends StateType<TMachine>,
> =
  | Target
  | {
      target: Target
      guard?: GuardFn<TMachine, Target> | GuardFn<TMachine, Target>[]
    }

export type SubStates<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  TStateId extends string,
> = {
  [key in ParentStatePaths<SubStatesAtPath<StateType<TMachine>, TStateId>>]:
    | StateArgs<
        StateMachineDefinition<
          OwnerType<TMachine>,
          | StateType<TMachine>
          // satisfy TS
          | `${TStateId}.${key}`,
          PayloadsType<TMachine>
        >,
        `${TStateId}.${key}`
      >
    | State<
        StateMachineDefinition<
          OwnerType<TMachine>,
          | StateType<TMachine>
          // satisfy TS
          | `${TStateId}.${key}`,
          PayloadsType<TMachine>
        >,
        `${TStateId}.${key}`
      >
}

/**
 * Extracts the state type from a StateMachine
 */
export type StateType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> =
  TMachine extends StateMachineDefinition<any, infer TState, any, any>
    ? TState
    : never

export type ContextType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> =
  TMachine extends StateMachineDefinition<any, any, any, infer TContext>
    ? TContext
    : {}

/**
 * Extracts the owner type from a StateMachine
 */
export type OwnerType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> =
  TMachine extends StateMachineDefinition<infer TOwner, any, any, any>
    ? TOwner
    : never

/**
 * Extracts the payloads type from a StateMachine
 */
export type PayloadsType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> =
  TMachine extends StateMachineDefinition<any, any, infer TPayloads, any>
    ? TPayloads
    : never

/**
 * Returns the parent state types of the machine
 */
export type ParentStateType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> =
  TMachine extends StateMachineDefinition<any, infer TState, any, any>
    ? ParentStatePaths<TState>
    : never

/**
 * Returns all states that are sub states
 */
export type SubStateType<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  TStateId extends StateType<TMachine> | ParentStateType<TMachine>,
> =
  TMachine extends StateMachineDefinition<any, infer TState, any, any>
    ? TState extends `${TStateId}.${infer TSubState}`
      ? TState
      : never
    : never

export type GuardFn<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  Target extends StateType<TMachine>,
> = (ev: EnterStateEvent<TMachine, Target>) => boolean

export interface EnterStateEvent<
  TMachine extends StateMachineDefinition<any, any, any, any>,
  TStateId extends StateType<TMachine>,
> {
  owner: OwnerType<TMachine>
  context: ContextType<TMachine>
  payload: PayloadsType<TMachine>[TStateId]
  nextState: TStateId
  prevState: StateType<TMachine>
}

export interface ExitStateEvent<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> {
  owner: OwnerType<TMachine>
  context: ContextType<TMachine>
  payload: PayloadsType<TMachine>[StateType<TMachine>]
  nextState: StateType<TMachine>
  prevState: StateType<TMachine>
}

export interface PreUpdateStateEvent<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> {
  owner: OwnerType<TMachine>
  context: ContextType<TMachine>
  engine: ex.Engine
  delta: number
}

export interface PostUpdateStateEvent<
  TMachine extends StateMachineDefinition<any, any, any, any>,
> {
  owner: OwnerType<TMachine>
  context: ContextType<TMachine>
  engine: ex.Engine
  delta: number
}

/* -------------------------------------------------------------------------- */
/*                                HELPER TYPES                                */
/* -------------------------------------------------------------------------- */
type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T
}

type isUnknown<T> = unknown extends T ? true : false
type isOptional<T> = undefined extends T ? true : false

/**
 * Returns all root states along the path
 *
 * e.g. RootStateType<'a.b.c'> -> 'a'
 */
type ParentStatePaths<TPath extends string> =
  TPath extends `${infer P}.${infer R}` ? P : TPath

/**
 * Returns the sub state type of the given state
 *
 * ex: SubStatesAtPath<'a.b.c.d', 'a.b'> => 'c.d'
 */
type SubStatesAtPath<
  T extends string,
  P extends string,
> = T extends `${P}.${infer R}` ? R : never

type IsEmptyObject<T> = T extends object
  ? keyof T extends never
    ? true
    : false
  : true
