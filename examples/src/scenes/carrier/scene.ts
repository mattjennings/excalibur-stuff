import * as ex from 'excalibur'
import { SimplePlayer } from '../../actors/simple-player'
import {
  CarriableComponent,
  CarrierComponent,
} from '../../../../components/physics/carrier'

class Player extends SimplePlayer {
  constructor(x: number, y: number) {
    super({ x, y })

    this.addComponent(new CarriableComponent())
  }
}

class Platform extends ex.Actor {
  constructor(x: number, y: number) {
    super({
      x,
      y,
      width: 200,
      height: 20,
      color: ex.Color.Green,
      collisionType: ex.CollisionType.Fixed,
    })
    this.addComponent(new CarrierComponent())
    this.actions.repeatForever((ctx) =>
      ctx.moveBy(ex.vec(100, -100), 100).moveBy(ex.vec(-100, 100), 100),
    )
  }
}
export default class Carrier extends ex.Scene {
  onInitialize(engine: ex.Engine): void {
    this.add(new Player(400, 400))
    this.add(new Platform(400, 500))

    this.add(
      new ex.Actor({
        anchor: ex.vec(0, 0),
        width: 800,
        height: 100,
        pos: ex.vec(0, 550),
        color: ex.Color.Gray,
        collisionType: ex.CollisionType.Fixed,
      }),
    )
  }
}
