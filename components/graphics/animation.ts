import {
  AsepriteNativeParser,
  AsepriteResource,
} from '@excaliburjs/plugin-aseprite'
import * as ex from 'excalibur'

enum Facing {
  Left = -1,
  Right = 1,
}

/**
 * Allows you to set the animations on the actor by key, adjust the speed of the animations,
 * and get the current animation.
 */
export class AnimationComponent<Keys extends string> extends ex.Component {
  declare owner: ex.Entity & { graphics: ex.GraphicsComponent }
  private _animations: Record<Keys, ex.Animation>
  private _aseprite: AsepriteResource | null = null

  type = 'animation'

  facing: Facing = Facing.Right

  constructor(animations: Record<Keys, ex.Animation> | AsepriteResource) {
    super()
    if (animations instanceof AsepriteResource) {
      this._animations = Object.fromEntries(
        animations.data.animations.entries(),
      ) as Record<Keys, ex.Animation>
      this._aseprite = animations
    } else {
      this._animations = animations
    }
  }

  /**
   * Sets the current animation starting from the beginning. If the animation is already playing,
   * it will not be restarted.
   *
   * @param name The name of the animation to set.
   * @param opts Options for setting the animation.
   * @param opts.frame The frame to set the animation to. If 'current', the current frame will be used.
   */
  set(
    name: Keys,
    opts: {
      force?: boolean
      frame?: number | 'current'
    } = {},
  ): ex.Animation {
    const { frame, force } = opts

    const prevAnim = this.current
    const anim = this._animations[name]

    // return if the animation is already playing
    if (this.is(name) && !force) return this.current

    if (frame || frame === 0) {
      if (frame === 'current') {
        const currentFrameIndex = this.current.currentFrameIndex
        const currentFrameTimeLeft = this.current.currentFrameTimeLeft

        anim.goToFrame(currentFrameIndex, currentFrameTimeLeft)
      } else {
        anim.reset()
        anim.goToFrame(frame)
      }
    } else {
      anim.reset()
    }

    // carry over scale from the previous graphic
    if (prevAnim) {
      anim.scale.setTo(prevAnim.scale.x, prevAnim.scale.y)
      anim.opacity = prevAnim.opacity
      anim.speed = prevAnim.speed
    }

    this.owner.graphics.use(anim)
    return anim
  }

  /**
   * Returns the animation by name.
   */
  get(name: Keys) {
    return this._animations[name]
  }

  /**
   * Sets the speed of the animation. 1 is normal speed, 2 is double speed, etc.
   */
  set speed(value: number) {
    this.current.speed = value
  }

  /**
   * Returns the speed of the animation.
   */
  get speed() {
    return this.current.speed
  }

  /**
   * Returns the current animation.
   */
  get current() {
    return this.owner.graphics.current as ex.Animation
  }

  get currentName() {
    return Object.keys(this._animations).find(
      (key) => (this._animations as any)[key] === this.current,
    ) as Keys
  }

  get currentFrame() {
    return this.current.currentFrame
  }

  get currentFrameIndex() {
    return this.current.currentFrameIndex
  }

  /**
   * Returns the current frame index + the progress of the current frame as a decimal. For example
   * if the current frame is 3 and the frame is halfway through, the result will be 3.5.
   */
  get currentFrameIndexWithProgress() {
    // @ts-ignore - _timeLeftInFrame is private but we need it
    const timeLeft: number = this.current._timeLeftInFrame ?? 0
    const duration = this.currentFrame?.duration ?? 0

    if (timeLeft >= duration) {
      return this.currentFrameIndex
    }

    return this.currentFrameIndex + (1 - timeLeft / duration)
  }

  is(...animation: Keys[]) {
    return animation.some((name) => this.current === this._animations[name])
  }

  isNot(...name: Keys[]) {
    return !this.is(...name)
  }

  get done() {
    return this.current.done
  }

  face(facing: Facing = this.facing) {
    this.facing = facing
    if (facing === Facing.Right) {
      this.current.scale.x = 1
    } else {
      this.current.scale.x = -1
    }
  }
}
