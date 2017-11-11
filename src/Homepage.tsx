import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

import * as d3 from 'd3'
import * as d3_chromatic from 'd3-scale-chromatic'

declare global {
  interface Window {
    homepageStart: Function
  }
}

const BLANK = "#343434"
const GREEN = "#3BC376"

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
    

    get(hex: Hex): T {
        return this.cells.get(hex.key) as T
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

class Cell {
    hex: Hex
    @observable color = "#fff"

    constructor(hex: Hex) {
        this.hex = hex
    }
}

// hexagons move towards center
// match colors by drawing a single unbroken path

class Game {
    @computed get ringSize() { return 8 }

    @computed get ringHexes() {
        const {ringSize} = this
        return Hex.rings(Hex.zero, 0, ringSize)
    }

    @computed get cells(): Cell[] {
        return this.ringHexes.map(hex => this.hexGrid.get(hex) as Cell)
    }

    hexGrid: HexGrid<Cell>
    constructor() {
        this.hexGrid = new HexGrid<Cell>()
        this.ringHexes.forEach(hex => this.hexGrid.set(hex, new Cell(hex)))

        const colors = [GREEN, '#E75070', '#EF8243', '#DA4D47']
        this.cells.forEach(cell => {
            cell.color = colors[Math.floor(Math.random()*colors.length)]
        })
    }

    frame() {
        /*const hasChanged = new Map<string, boolean>()
        for (let pop of this.populations) {
            // XXX remove iteration bias
            const willReproduce = pop.isReproducing

            if (willReproduce) {
                const target = _(pop.neighbors).sample() as Population
                target.dist += 1
                target.isReproducing = true
            }
        }*/
    }
}

@observer
class SimulationView extends React.Component<{ width: number, height: number }> {
    @computed get sim() { return new Game() }
    @computed get screenCenterX() { return this.props.width/2 }
    @computed get screenCenterY() { return this.props.height/2 }
    @computed get hexRadius() { return Math.round(Math.min(this.props.height, this.props.width)/(this.sim.ringSize)/4) }

    @observable isMouseDown: boolean = false
    @observable currentSelection: Cell[] = []

    timeCounter = 0
    prevTime?: number
    paused: boolean = false
    @action.bound frame(time: number) {
        const deltaTime = time - (this.prevTime||time)
        this.prevTime = time

        const frameInterval = 20
        this.timeCounter += deltaTime
        if (this.timeCounter > frameInterval && !this.paused) {
            this.sim.frame()
            this.timeCounter -= frameInterval
        }

        requestAnimationFrame(this.frame)
    }

    componentDidMount() {
        requestAnimationFrame(this.frame)
        window.onkeydown = () => { this.paused = !this.paused }
    }

    @action.bound onMouseDown(hex: Hex) {
        const targetCell = this.sim.hexGrid.get(hex)
        this.currentSelection = [targetCell]
    }

    @action.bound onMouseMove(hex: Hex) {
        const targetCell = this.sim.hexGrid.get(hex)

        if (this.currentSelection.length) {
            const initialCell = this.currentSelection[0]

            if (initialCell.hex.neighbors.some(hex => hex.key == targetCell.hex.key)) {
                const color = this.currentSelection[0].color
                this.currentSelection[0].color = targetCell.color
                targetCell.color = color
                this.currentSelection = []
            }
        }
//        if (this.currentSelection.length >= 2)
//            this.currentSelection.forEach(cell => cell.color = BLANK)
//        this.currentSelection = []
    }

    @action.bound onMouseUp() {
        
    }

    render() {
        const {props, screenCenterX, screenCenterY, hexRadius, sim} = this

        return <svg width={props.width} height={props.height}>
            {sim.cells.map(cell => {
                const hex = cell.hex
                const screenX = screenCenterX + hexRadius * Math.sqrt(3) * (hex.q + hex.r/2)
                const screenY = screenCenterY + hexRadius * 3/2 * hex.r
                const isSelected = this.currentSelection.indexOf(cell) !== -1

                return <polygon onMouseDown={e => this.onMouseDown(hex)} onMouseMove={e => this.onMouseMove(hex)} onMouseUp={e => this.onMouseUp(hex)} points={hexagonPoints(screenX, screenY, hexRadius).join(" ")} fill={(sim.hexGrid.get(hex) as Cell).color} stroke={isSelected ? 'cyan' : "#000"} strokeWidth={3}/>
            })}
        </svg>
    }
}

declare var require: any
window.homepageStart = function() {
    function render() {
        ReactDOM.render(<SimulationView width={window.innerWidth} height={window.innerHeight} />, document.querySelector("#simulation"))
    }

    window.onresize = render
    render()
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <main>
            <div id="simulation">
                <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
            </div>
        </main>
	}
}
