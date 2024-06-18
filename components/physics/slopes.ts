import * as ex from 'excalibur'

/**
 * Allows actor to climb slopes without sliding down or impacting
 * x velocity. Requires SlopeSystem to be added to the world.
 *
 * Velocity is adjusted by the SlopeSystem during the update loop. If you wish to change
 * the velocity on the entity **after** moving along the slope (for example, jumping),
 * you should do so during postupdate.
 *
 * You can check if you're currently on a slope by using the `isOnSlope` on the component.
 */
export class SlopesComponent extends ex.Component {
  slope?: {
    collider: ex.Collider
    contact: ex.CollisionContact
  }

  get isOnSlope() {
    return !!this.slope
  }

  private get vel() {
    const motion = this.owner?.get(ex.MotionComponent)

    if (!motion) {
      throw new Error('MotionComponent is required on owner')
    }

    return motion.vel
  }

  onAdd(owner: ex.Entity<any>): void {
    const collider = owner.get(ex.ColliderComponent)
    collider.events.on('precollision', this.onPreCollisionResolve.bind(this))
    collider.events.on('collisionend', this.onCollisionEnd.bind(this))
  }

  onPreCollisionResolve({
    contact,
    other,
  }: {
    contact: ex.CollisionContact
    other: ex.Collider
  }): void {
    // determine if collision happened on a sloped plane
    const isSlope =
      Math.abs(contact.normal.y) > 0 && Math.abs(contact.normal.y) < 1

    if (isSlope) {
      this.slope = {
        collider: other,
        contact,
      }

      const { slope, intercept, begin, end } = contact.info.side!

      const point = contact.info.point
      const x = ex.clamp(point.x, begin.x, end.x)
      const y = slope * x + intercept
      contact.mtv.x = 0
      contact.mtv.y = point.y - y
    }
  }

  onCollisionEnd({ other }: { other: ex.Collider }): void {
    if (this.slope?.collider === other) {
      this.slope = undefined
      this.vel.y = 0
    }
  }
}

export class SlopesSystem extends ex.System {
  query: ex.Query<typeof ex.MotionComponent | typeof SlopesComponent>

  constructor(world: ex.World) {
    super()
    this.query = world.query([ex.MotionComponent, SlopesComponent])
  }

  // should run before ex.MotionSystem, which is priority -5
  public priority = -6

  public systemType = ex.SystemType.Update

  public update() {
    for (let entity of this.query.entities) {
      const motion = entity.get(ex.MotionComponent)
      const slopes = entity.get(SlopesComponent)

      if (slopes.slope) {
        if (motion.vel.x !== 0) {
          const plane = slopes.slope.contact.info.side

          if (plane) {
            const { begin, end, slope } = plane
            const currentVelSlope = motion.vel.y / motion.vel.x

            // only adjust velocity if current velocity is not steeper than the slope
            if (Math.abs(currentVelSlope) < Math.abs(slope)) {
              const deltaX = end.x - begin.x
              const deltaY = end.y - begin.y
              const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

              const slopeDirX = deltaX / length
              const slopeDirY = deltaY / length

              const velocityAlongSlope =
                motion.vel.x * slopeDirX + motion.vel.y * slopeDirY

              const newVel = ex.vec(
                velocityAlongSlope * slopeDirX,
                velocityAlongSlope * slopeDirY,
              )

              motion.vel.x = newVel.x
              motion.vel.y = newVel.y
            }
          }
        }
      }
    }
  }
}
