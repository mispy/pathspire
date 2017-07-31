import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

import * as d3 from 'd3'
import * as d3_chromatic from 'd3-scale-chromatic'
import * as PIXI from 'pixi.js'
declare global {
  interface Window {
    homepageStart: Function
  }
}

class Hex {
    static directions = [
        new Hex(+1, -1, 0), new Hex(+1, 0, -1), new Hex(0, +1, -1),
        new Hex(-1, +1, 0), new Hex(-1, 0, +1), new Hex(0, -1, +1)
    ]

    static zero = new Hex(0, 0, 0)

    static ring(center: Hex, radius: number): Hex[] {
        const results: Hex[] = []
        let hex = center.add(Hex.directions[4].scale(radius))
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < radius; j++) {
                results.push(hex)
                hex = hex.neighbor(i)
            }
        }
        return results
    }

    static spiral(center: Hex, radius: number) {
        const results = [center]
        for (let i = 1; i < radius; i++) {
            results.push(...Hex.ring(center, i))
        }
        return results
    }

    add(b: Hex) {
        return new Hex(this.q+b.q, this.r+b.r, this.s+b.s)
    }

    scale(amount: number) {
        return new Hex(this.q*amount, this.r*amount, this.s*amount)
    }

    neighbor(index: number) {
        return this.add(Hex.directions[index])
    }

    q: number
    r: number
    s: number

    constructor(q: number, r: number, s: number) {
        console.assert(q + r + s == 0)
        this.q = q
        this.r = r
        this.s = s
    }
}

class HexGrid {
    cells: Map<string, boolean> = new Map()

    constructor(radius: number) {        
        for (var i = -radius; i <= radius; i++) {
            for (var j = -radius; j <= radius; j++) {
                this.set(new Hex(i, j, -i-j), true)
            }
        }
    }

    get(hex: Hex) {
        return this.cells.get(`${hex.q},${hex.r},${hex.s}`)
    }

    set(hex: Hex, value: boolean) {
        return this.cells.set(`${hex.q},${hex.r},${hex.s}`, value)
    }

    forEach(callback: (hex: Hex) => void) {
        return this.cells.forEach((val, key) => {
            const [q, r, s] = key.split(",").map(s => parseInt(s))
            callback(new Hex(q, r, s))
        })
    }
}

function drawHexagon(graphics: PIXI.Graphics, cx: number, cy: number, size: number) {
    const path = []
    for (var i = 0; i < 6; i++) {
        const angle = Math.PI/180 * (60*i + 30)
        path.push(Math.round(cx+size*Math.cos(angle)))
        path.push(Math.round(cy+size*Math.sin(angle)))
    }
    graphics.drawPolygon(path)
}

declare var require: any
window.homepageStart = function() {
    //const PIXI = require('pixi.js')
    const app = new PIXI.Application(window.innerWidth, window.innerHeight, { transparent: true })
    document.body.appendChild(app.view)

    const size = 10

    const graphics = new PIXI.Graphics()
    //graphics.beginFill(0)
    //drawHexagon(graphics, 0, 0, size)
    graphics.beginFill(0xFFFFFF)
    drawHexagon(graphics, 0, 0, size)
    graphics.endFill()
    const hexTexture = app.renderer.generateTexture(graphics)

    const cx = Math.round(app.renderer.width/2)
    const cy = Math.round(app.renderer.height/2)
    const container = new PIXI.Container()
    app.stage.addChild(container)

    app.renderer.roundPixels = true

    const hexes = Hex.spiral(Hex.zero, 100)

    let offset = 0
    let timer = -1
    let elapsed = 0
    app.ticker.add(deltaTime => {
        if (offset >= hexes.length)
            return

        timer += deltaTime
        elapsed += deltaTime
        const timeRequired = 1 * Math.pow(0.99, elapsed)

        while (timer > timeRequired && offset < hexes.length-1) {
            timer -= timeRequired

            offset += 1
            const hex = hexes[offset]
            const screenX = cx + size * Math.sqrt(3) * (hex.q + hex.r/2)
            const screenY = cy + size * 3/2 * hex.r
            const hexSprite = new PIXI.Sprite(hexTexture)
            hexSprite.x = screenX
            hexSprite.y = screenY
            hexSprite.tint = Math.random() * 0xFFFFFF
            hexSprite.alpha = 0.5
            container.addChild(hexSprite)
        }

        container.children.forEach(sprite => (sprite as PIXI.Sprite).tint = Math.random() * 0xFFFFFF)
    })
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
	}
}
