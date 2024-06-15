import * as ex from 'excalibur'

const createFragment = (args: {
  isPostProcessor?: boolean
  maxColors: number
}) => {
  const textureUniformName = args.isPostProcessor ? 'u_image' : 'u_texture'
  const textureCoordUniformName = args.isPostProcessor ? 'v_texcoord' : 'v_uv'

  return /* glsl */ `\
    #version 300 es
    precision highp float;

    // our texture
    uniform sampler2D ${textureUniformName};

    // the texCoords passed in from the vertex shader.
    in vec2 ${textureCoordUniformName};
    out vec4 fragColor;

    uniform float[${args.maxColors * 3}] palette;

    vec4 quantize(vec4 color) {
      return vec4(
        floor(color.r * 255.0 + 0.5) / 255.0,
        floor(color.g * 255.0 + 0.5) / 255.0,
        floor(color.b * 255.0 + 0.5) / 255.0,
        color.a
      );
    }

    float manhattanDistance(vec3 a, vec3 b) {
      return abs(a.r - b.r) + abs(a.g - b.g) + abs(a.b - b.b);
    }

    float euclideanDistance(vec3 a, vec3 b) {
      return sqrt(pow(a.r - b.r, 2.0) + pow(a.g - b.g, 2.0) + pow(a.b - b.b, 2.0));
    }

    void main() {
      vec4 color = texture(${textureUniformName}, ${textureCoordUniformName});
      vec4 quantizedColor = quantize(color);

      // find the closest color in the palette
      float minDist = 1e10;
      vec4 bestMatch = quantizedColor;

      for (int i = 0; i < ${args.maxColors}; i++) {
        // end of palette
        if (palette[i * 3] == -1.0) {
          break;
        }

        vec4 paletteColor = vec4(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], color.a);
        float dist = manhattanDistance(quantizedColor.rgb, paletteColor.rgb);

        if (dist < minDist) {
          minDist = dist;
          bestMatch = paletteColor;
        }
      }
      
      fragColor = bestMatch;
    }
`
}

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
      createFragment({
        maxColors: this.MAX_COLORS,
        isPostProcessor: true,
      }),
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

export class ColorizeMaterial<Palette extends string> extends ex.Material {
  private _palette!: Palette
  private palettes: Record<Palette, ex.Color[]> = {} as any

  constructor(args: {
    current: NoInfer<Palette>
    palettes: Record<Palette, ex.Color[]>
    graphicsContext: ex.ExcaliburGraphicsContext
  }) {
    super({
      name: 'ColorizeMaterial',
      fragmentSource: createFragment({
        maxColors: 85,
      }),
      graphicsContext: args.graphicsContext,
    })
    this._palette = args.current
    this.palettes = args.palettes
    this.setPalette(this._palette)
  }

  getPalette() {
    return this.palettes[this._palette]
  }

  setPalette(palette: Palette) {
    this._palette = palette
    this.update((shader) => {
      shader.setUniformFloatArray(
        'palette',
        this.getPalette().flatMap((color) => [
          color.r / 255.0,
          color.g / 255.0,
          color.b / 255.0,
        ]),
      )
    })
  }

  nextPalette() {
    const keys = Object.keys(this.palettes) as Palette[]
    const currentIndex = keys.indexOf(this._palette)
    const nextIndex = (currentIndex + 1) % keys.length
    this.setPalette(keys[nextIndex])
  }
}

/* Usage (disable antialiasing on engine for best results)*/

/* Postprocessor

const postProcessor = new ColorizePostProcessor({
  current: 'gameboyGreen',
  palettes: {
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

/* Material

  onInitialize(engine: Engine<any>): void {
    super.onInitialize(engine)

    this.graphics.material = new ColorizeMaterial({
      current: 'gameboy',
      palettes: {
        gameboy: [
          ex.Color.fromHex('#000000'),
          ex.Color.fromHex('#545454'),
          ex.Color.fromHex('#a9a9a9'),
          ex.Color.fromHex('#ffffff'),
        ],
      },
      graphicsContext: engine.graphicsContext,
    })
  }
    
*/