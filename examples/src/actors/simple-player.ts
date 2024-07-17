import * as ex from 'excalibur'

export class SimplePlayer extends ex.Actor {
  speed = 300

  constructor(args: ex.ActorArgs) {
    super({
      ...args,
      width: 40,
      height: 40,
      color: ex.Color.Blue,
      collisionType: ex.CollisionType.Active,
    })
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (engine.input.keyboard.isHeld(ex.Input.Keys.Left)) {
      this.vel.x = -this.speed
    } else if (engine.input.keyboard.isHeld(ex.Input.Keys.Right)) {
      this.vel.x = this.speed
    } else {
      this.vel.x = 0
    }

    if (engine.input.keyboard.isHeld(ex.Input.Keys.Up)) {
      this.vel.y = -this.speed * 2
    }
  }
}
