import * as ex from 'excalibur'

export class ControlsComponent extends ex.Component {
  declare owner: ex.Entity

  type = 'input'

  controls = {
    left: [ex.Keys.Left, ex.Buttons.DpadLeft],
    right: [ex.Keys.Right, ex.Buttons.DpadRight],
    up: [ex.Keys.Up, ex.Buttons.DpadUp],
    down: [ex.Keys.Down, ex.Buttons.DpadDown],
    jump: [ex.Keys.A, ex.Buttons.Face1],
    dash: [ex.Keys.D, ex.Buttons.Face2],
    shoot: [ex.Keys.S, ex.Buttons.Face3],

    Debug_SlowMo: [ex.Input.Keys.Space, ex.Input.Buttons.RightBumper],
    Debug_Restart: [ex.Input.Keys.ShiftLeft, ex.Input.Buttons.LeftBumper],
  } as const

  isHeld(control: keyof typeof this.controls) {
    const engine = this.owner.scene!.engine
    const [key, button] = this.controls[control]

    return Boolean(
      engine.input.keyboard.isHeld(key) ||
        this.getGamepad()?.isButtonHeld(button),
    )
  }

  wasPressed(control: keyof typeof this.controls) {
    const engine = this.owner.scene!.engine
    const [key, button] = this.controls[control]

    return Boolean(
      engine.input.keyboard.wasPressed(key) ||
        this.getGamepad()?.wasButtonPressed(button),
    )
  }

  wasReleased(control: keyof typeof this.controls) {
    const engine = this.owner.scene!.engine
    const [key, button] = this.controls[control]

    return Boolean(
      engine.input.keyboard.wasReleased(key) ||
        this.getGamepad()?.wasButtonReleased(button),
    )
  }

  getGamepad() {
    const engine = this.owner.scene!.engine
    return [
      engine.input.gamepads.at(0),
      engine.input.gamepads.at(1),
      engine.input.gamepads.at(2),
      engine.input.gamepads.at(3),
    ].find((g) => g.connected)
  }

  /**
   * Returns the latest of the Left or Right keys that was pressed. Helpful for
   * keyboard controls where both keys may be pressed at the same time if you
   * want to prioritize one over the other.
   */
  getHeldXDirection(): 'left' | 'right' | undefined {
    const engine = this.owner.scene!.engine

    for (const key of engine.input.keyboard.getKeys().slice().reverse()) {
      if (this.controls.left.includes(key as any)) return 'left'
      if (this.controls.right.includes(key as any)) return 'right'
    }

    if (this.getGamepad()) {
      if (this.isHeld('left')) return 'left'
      if (this.isHeld('right')) return 'right'
    }
  }

  getHeldYDirection(): 'Up' | 'Down' | undefined {
    const engine = this.owner.scene!.engine

    for (const key of engine.input.keyboard.getKeys().slice().reverse()) {
      if (this.controls.up.includes(key as any)) return 'Up'
      if (this.controls.down.includes(key as any)) return 'Down'
    }

    if (this.getGamepad()) {
      if (this.isHeld('up')) return 'Up'
      if (this.isHeld('down')) return 'Down'
    }
  }
}
