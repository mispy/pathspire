import * as _ from 'lodash'
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
        if (radius == 0) return [center]

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

    static rings(center: Hex, startRadius: number, endRadius: number) {
        const results = []
        for (let i = startRadius; i < endRadius; i++) {
            results.push(...Hex.ring(center, i))
        }
        return results
    }

    readonly q: number
    readonly r: number
    readonly s: number

    constructor(q: number, r: number, s: number) {
        console.assert(q + r + s == 0)
        this.q = q
        this.r = r
        this.s = s
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

    get neighbors() {
        return Hex.directions.map(hex => this.add(hex))
    }

    get key() {
        return `${this.q},${this.r},${this.s}`        
    }
}

class HexGrid<T> {
    @observable cells: Map<string, T> = new Map()

    constructor() {        
    }
    

    get(hex: Hex) {
        return this.cells.get(hex.key)
    }

    set(hex: Hex, value: T) {
        return this.cells.set(hex.key, value)
    }

    forEach(callback: (hex: Hex) => void) {
        return this.cells.forEach((val, key) => {
            const [q, r, s] = key.split(",").map(s => parseInt(s))
            callback(new Hex(q, r, s))
        })
    }
}

function hexagonPoints(cx: number, cy: number, size: number) {
    const path = []
    for (var i = 0; i < 6; i++) {
        const angle = Math.PI/180 * (60*i + 30)
        path.push(Math.round(cx+size*Math.cos(angle))+","+Math.round(cy+size*Math.sin(angle)))
    }
    return path
}

class Population {
    hex: Hex
    @observable color: string

    constructor(hex: Hex, color: string) {
        this.hex = hex
        this.color = color
    }
}

class RingSpeciesSimulation {
    @computed get mountainSize() { return 10 }
    @computed get ringSize() { return 5 }

    @computed get ringHexes() {
        const {mountainSize, ringSize} = this
        return Hex.rings(Hex.zero, mountainSize, mountainSize+ringSize)
    }

    hexGrid: HexGrid<Population>
    constructor() {
        this.hexGrid = new HexGrid<Population>()
        this.ringHexes.forEach(hex => this.hexGrid.set(hex, new Population(hex, Math.random() > 0.5 ? "#000" : "#fff")))
    }

    @computed get populations(): Population[] {
        return this.ringHexes.map(hex => this.hexGrid.get(hex) as Population)
    }


    frame() {
        const hasChanged = new Map<string, boolean>()
        for (let pop of this.populations) {
            const willReproduce = true

            if (willReproduce) {
                const neighbors = _(pop.hex.neighbors).map(hex => this.hexGrid.get(hex)).filter(d => !!d)
                const target = neighbors.sample() as Population
                target.color = pop.color
            }
        }
    }
}

@observer
class SimulationView extends React.Component {
    @observable screenWidth: number
    @observable screenHeight: number

    @computed get sim() { return new RingSpeciesSimulation() }
    @computed get screenCenterX() { return this.screenWidth/2 }
    @computed get screenCenterY() { return this.screenHeight/2 }
    @computed get hexRadius() { return Math.round(Math.min(this.screenHeight, this.screenWidth)/(this.sim.mountainSize+this.sim.ringSize)/4) }

    timeCounter = 0
    @action.bound frame(deltaTime: number) {
        this.timeCounter += deltaTime
        const frameInterval = 10000
        if (this.timeCounter > frameInterval) {
            this.sim.frame()
            this.timeCounter -= frameInterval
        }
        requestAnimationFrame(this.frame)
    }

    componentWillMount() {
        this.screenWidth = window.innerWidth
        this.screenHeight = window.innerHeight
    }

    componentDidMount() {
        window.onresize = () => {
            this.screenWidth = window.innerWidth
            this.screenHeight = window.innerHeight
        }
        requestAnimationFrame(this.frame)
    }

    render() {
        const {screenWidth, screenHeight, screenCenterX, screenCenterY, hexRadius, sim} = this

        return <svg width={screenWidth} height={screenHeight}>
            {sim.ringHexes.map(hex => {
                const screenX = screenCenterX + hexRadius * Math.sqrt(3) * (hex.q + hex.r/2)
                const screenY = screenCenterY + hexRadius * 3/2 * hex.r
                return <polygon points={hexagonPoints(screenX, screenY, hexRadius).join(" ")} fill={(sim.hexGrid.get(hex) as Population).color} stroke="#ccc"/>
            })}
        </svg>
    }
}

declare var require: any
window.homepageStart = function() {
    ReactDOM.render(<SimulationView/>, document.body)
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
	}
}
