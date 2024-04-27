import * as ex from 'excalibur'
import { DamageableComponent } from './damageable'
import { KillableComponent } from './killable'

/**
 * Hurts the other actor on collision if it has a Damageable component
 */
export class DamageComponent extends ex.Component {
  declare owner: ex.Actor

  amount: number

  cancelContactOnDamage: boolean

  constructor({
    amount,
    cancelContactOnDamage,
  }: {
    amount: number
    cancelContactOnDamage?: boolean
  }) {
    super()

    this.amount = amount
    this.cancelContactOnDamage = cancelContactOnDamage ?? true
  }

  onAdd(owner: ex.Actor): void {
    owner.on('precollision', this.onPreCollisionResolve.bind(this))
  }

  onPreCollisionResolve(event: ex.PreCollisionEvent) {
    const killable = this.owner.get(KillableComponent)

    const dead = killable?.dead ?? false

    const other = event.other
    const damageable = other.get(DamageableComponent)

    if (damageable) {
      if (this.cancelContactOnDamage) {
        event.contact.cancel()
      }

      if (!dead) {
        damageable.damage(
          this.amount,
          other.center.x < this.owner.center.x ? 'left' : 'right',
        )
      }
    }
  }
}
