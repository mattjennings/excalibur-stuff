import * as ex from 'excalibur'

export type KillMethod = 'instant'

/**
 * Makes an actor damage the player on collision.
 */
export class KillableComponent extends ex.Component {
  declare owner: ex.Actor

  dead = false

  events = new ex.EventEmitter<{ kill: { method: KillMethod } }>()

  kill(method: KillMethod) {
    if (this.dead) return
    this.dead = true

    this.events.emit('kill', { method })

    if (method === 'instant') {
      this.owner.kill()
    }
  }
}
