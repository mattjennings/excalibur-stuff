import * as ex from 'excalibur'
import { SimplePlayer } from '../../actors/simple-player'
import {
  SlopesComponent,
  SlopesSystem,
} from '../../../../components/physics/slopes'

class Player extends SimplePlayer {
  constructor(x: number, y: number) {
    super({ x, y })
    this.addComponent(new SlopesComponent())
  }
}

export default class Slopes extends ex.Scene {
  constructor() {
    super()
    this.world.systemManager.addSystem(SlopesSystem)
  }

  onInitialize(engine: ex.Engine) {
    this.physics.config.gravity.y = 1600

    const player = new Player(850, 300)
    this.add(player)
    this.camera.strategy.lockToActorAxis(player, ex.Axis.X)
    const ground = new ex.Actor({
      pos: ex.vec(400, 600),
      width: 9999,
      height: 100,
      color: ex.Color.Gray,
      collisionType: ex.CollisionType.Fixed,
    })
    this.add(ground)

    const slopes = [
      {
        pos: ex.vec(100, 550),
        anchor: ex.vec(1, 1),
        collider: ex.Shape.Polygon([
          ex.vec(0, 0),
          ex.vec(-200, -20),
          ex.vec(-200, 0),
        ]),
      },
      {
        pos: ex.vec(200, 550),
        collider: ex.Shape.Polygon([
          ex.vec(0, 0),
          ex.vec(200, -100),
          ex.vec(200, 0),
        ]),
        anchor: ex.vec(0, 1),
      },
      {
        pos: ex.vec(600, 550),
        anchor: ex.vec(1, 1),
        collider: ex.Shape.Polygon([
          ex.vec(0, 0),
          ex.vec(-200, -100),
          ex.vec(-200, 0),
        ]),
      },
      {
        pos: ex.vec(800, 550),
        collider: ex.Shape.Polygon([
          ex.vec(0, 0),
          ex.vec(200, -500),
          ex.vec(200, 0),
        ]),
        anchor: ex.vec(0, 1),
      },
    ]

    for (const slope of slopes) {
      const actor = new ex.Actor({
        ...slope,
        collisionType: ex.CollisionType.Fixed,
      })
      actor.graphics.add(
        new ex.Polygon({
          points: (actor.collider.get() as ex.PolygonCollider).points,
          color: ex.Color.Green,
        }),
      )
      this.add(actor)
    }
  }
}
