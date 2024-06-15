import * as ex from 'excalibur'

export class ColorizePostProcessor<Palette extends string>
  implements ex.PostProcessor
{
  public MAX_COLORS = 85

  private _shader!: ex.ScreenShader

  private currentPalette: Palette
  private palettes: Record<Palette, ex.Color[]> = {} as any
  private _dirty = true

  constructor(args: {
    current: NoInfer<Palette>
    palettes: Record<Palette, ex.Color[]>
  }) {
    this.currentPalette = args.current
    this.palettes = args.palettes
  }

  getCurrentPalette() {
    return this.palettes[this.currentPalette]
  }

  setPalette(palette: Palette) {
    this.currentPalette = palette
    this._dirty = true
  }

  nextPalette() {
    const keys = Object.keys(this.palettes) as Palette[]
    const currentIndex = keys.indexOf(this.currentPalette)
    const nextIndex = (currentIndex + 1) % keys.length
    this.setPalette(keys[nextIndex])
  }

  initialize(gl: WebGL2RenderingContext): void {
    this._shader = new ex.ScreenShader(
      gl,
      /* glsl */ `\
    #version 300 es
    precision mediump float;
    
    // our texture
    uniform sampler2D u_image;
    
    // the texCoords passed in from the vertex shader.
    in vec2 v_texcoord;
    out vec4 fragColor;

    uniform float[${this.MAX_COLORS * 3}] palette;

    void main() {
      vec4 color = texture(u_image, v_texcoord);

      // find the closest color in the palette
      float minDist = 1e10;
      int index = -1;
      fragColor = color;
      
      for (int i = 0; i < ${this.MAX_COLORS}; i++) {
        // empty color
        if (palette[i * 3] == -1.0) {
          break;
        }

        vec4 c = vec4(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2] , color.a);
        float dist = distance(color, c);
        if (dist < minDist) {
          minDist = dist;
          fragColor = c;
        }
      }
    }
    `,
    )
  }

  onUpdate(delta: number): void {
    if (this._dirty) {
      const colors = new Array(this.MAX_COLORS * 3).fill(-1)
      const palette = this.getCurrentPalette()

      for (let i = 0; i < palette.length; i++) {
        const color = palette[i]
        colors[i * 3] = color.r / 255.0
        colors[i * 3 + 1] = color.g / 255.0
        colors[i * 3 + 2] = color.b / 255.0
      }

      this.getShader().setUniformFloatArray('palette', colors)
      this._dirty = false
    }
  }

  getLayout(): ex.VertexLayout {
    return this._shader.getLayout()
  }

  getShader(): ex.Shader {
    return this._shader.getShader()
  }
}

/* Usage */
/*

const postProcessor = new ColorizePostProcessor({
  current: 'gameboyGreen',
  palettes: {
    gameboyGreen: [
      ex.Color.fromRGB(8, 24, 32),
      ex.Color.fromRGB(52, 104, 86),
      ex.Color.fromRGB(126, 192, 112),
      ex.Color.fromRGB(224, 248, 208),
    ],
    gameboyGray: [
      ex.Color.fromRGB(0, 0, 0),
      ex.Color.fromRGB(85, 85, 85),
      ex.Color.fromRGB(170, 170, 170),
      ex.Color.fromRGB(255, 255, 255),
    ],
    pastel: [
      ex.Color.fromHex('#000000'),
      ex.Color.fromHex('#fffcff'),
      ex.Color.fromHex('#e6e1f2'),
      ex.Color.fromHex('#b2b7e1'),
      ex.Color.fromHex('#595b7d'),
      ex.Color.fromHex('#7b8ac6'),
      ex.Color.fromHex('#ffd9f4'),
      ex.Color.fromHex('#e1adc3'),
      ex.Color.fromHex('#ad80a6'),
      ex.Color.fromHex('#fba2d7'),
      ex.Color.fromHex('#fae0c7'),
      ex.Color.fromHex('#f0abab'),
      ex.Color.fromHex('#97c4aa'),
      ex.Color.fromHex('#bfedf5'),
      ex.Color.fromHex('#73c9eb'),
      ex.Color.fromHex('#caaff5'),
    ],
  },
})

game.graphicsContext.addPostProcessor(postProcessor)

game.input.keyboard.on('press', (ev) => {
  if (ev.key === ex.Keys.P) {
    postProcessor.nextPalette()
  }
})

*/