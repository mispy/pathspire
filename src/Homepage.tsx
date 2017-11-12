import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

function sample<T>(arr: T[]): T {
    return arr[Math.floor(Math.random()*arr.length)]
}

declare const require: any
const TinyQueue = require('tinyqueue')

declare const window: any

const BLANK = "#343434"
const GREEN = "#3BC376"
const BARRIER = "cyan"

class PriorityQueue<T> {
    queue: any
    constructor() {
        this.queue = new TinyQueue([], (a: any, b: any) => a.priority - b.priority)
    }

    push(value: T, priority: number) {
        this.queue.push({ value, priority })
    }

    pop(): T {
        return this.queue.pop().value
    }

    get length(): number {
        return this.queue.length
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

    static distance(a: Hex, b: Hex) {
        return (Math.abs(a.q-b.q) + Math.abs(a.r-b.r) + Math.abs(a.s-b.s))/2
    }

    static lineBetween(a: Hex, b: Hex) {
        function lerp(a: number, b: number, t: number) {
            return a + (b - a) * t
        }

        function cubeLerp(a: Hex, b: Hex, t: number) {
            const x = lerp(a.q, b.q, t)
            const y = lerp(a.r, b.r, t)
            const z = lerp(a.s, b.s, t)

            let rx = Math.round(x)
            let ry = Math.round(y)
            let rz = Math.round(z)

            var x_diff = Math.abs(rx - x)
            var y_diff = Math.abs(ry - y)
            var z_diff = Math.abs(rz - z)
        
            if (x_diff > y_diff && x_diff > z_diff)
                rx = -ry-rz
            else if (y_diff > z_diff)
                ry = -rx-rz
            else
                rz = -rx-ry
        
            return new Hex(rx, ry, rz)            
        }

        const distance = Hex.distance(a, b)
        const line = []
        for (let i = 0; i < distance; i++) {
            line.push(cubeLerp(a, b, 1/distance * i))
        }
        line.push(b)

        return line
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

    equals(b: Hex) {
        return this.key === b.key
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
    game: Game
    hex: Hex
    @observable color = BLANK

    constructor(game: Game, hex: Hex) {
        this.game = game
        this.hex = hex
    }

    get neighbors(): Cell[] {
        return this.hex.neighbors.map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }

    circle(radius: number): Cell[] {
        return Hex.rings(this.hex, 0, radius).map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }

    lineTo(b: Cell) {
        return Hex.lineBetween(this.hex, b.hex).map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }
}

// player is green tile
// moves towards exit (white tile?)
// red tile enemies
// create blue tile barriers to block path of enemies

interface Enemy {
    hex: Hex
}

class Game {
    @observable playerLocation: Hex
    @observable exitLocation: Hex
    @observable numEnemies: number = 3
    @observable enemies: Enemy[] = []
    @observable numTeleports: number = 1
    @observable level = 1
    @observable state: 'game'|'success'|'failure' = 'game'

    @computed get playerCell(): Cell {
        return this.hexGrid.get(this.playerLocation)
    }

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
        this.setupBoard()
    }

    @action.bound setupBoard() {
        this.hexGrid = new HexGrid<Cell>()
        this.ringHexes.forEach(hex => this.hexGrid.set(hex, new Cell(this, hex)))
        this.playerLocation = new Hex(-3, 6, -3)
        this.exitLocation = new Hex(3, -6, 3)
        const barrierHexes = Hex.rings(Hex.zero, 0, 2)
        barrierHexes.forEach(hex => this.hexGrid.get(hex).color = "orange")

        this.enemies = []
        for (let i = 0; i < this.numEnemies; i++) {
            this.enemies.push({ hex: (sample(this.cells) as Cell).hex })
        }
    }

    @action.bound nextLevel() {
        if (this.state == 'success')
            this.level += 1
        else
            this.level = 1
        this.numTeleports = 1
        this.state = 'game'
        this.setupBoard()
    }

    pathBetween(start: Cell, goal: Cell): Cell[]|undefined {
        const frontier = new PriorityQueue<Cell>()
        frontier.push(start, 0)
        const cameFrom: Map<Cell, Cell|undefined> = new Map()
        const costSoFar: Map<Cell, number> = new Map()
        cameFrom.set(start, undefined)
        costSoFar.set(start, 0)

        while (frontier.length > 0) {
            const current = frontier.pop()

            if (current === goal)
                break;

            current.neighbors.forEach(nextCell => {
                if (nextCell.color !== BLANK) return

                const newCost = (costSoFar.get(current)||0) + 1
                const prevCost = costSoFar.get(nextCell)
                if (prevCost === undefined || newCost < prevCost) {
                    costSoFar.set(nextCell, newCost)
                    frontier.push(nextCell, newCost)
                    cameFrom.set(nextCell, current)
                }
            })
        }

        if (!cameFrom.has(goal))
            return undefined
        else {
            const path = []
            let current = goal
            while (current != start) {
                path.push(current)
                current = cameFrom.get(current) as Cell
            }
            path.reverse()
            return path
        }
    }

    @action.bound placeBarrier(start: Cell, end: Cell) {
        start.lineTo(end).forEach(cell => {
            cell.color = BARRIER
        })
    }

    endTurn() {
        if (this.playerLocation.equals(this.exitLocation)) {
            this.state = 'success'
            return
        }

        this.enemies.forEach(enemy => {
            const path = this.pathBetween(this.hexGrid.get(enemy.hex), this.hexGrid.get(this.playerLocation))
            if (path)
                enemy.hex = path[0].hex

            if (enemy.hex.equals(this.playerLocation)) {
                this.state = 'failure'
            }
        })
    }
}

@observer
class GameView extends React.Component<{ width: number, height: number }> {
    @computed get game() { return new Game() }
    @computed get hexRadius() { return Math.round(Math.min(this.props.width-50, this.props.height-100)/((this.game.ringSize+5)*2)) }
    @computed get boardWidth() { return this.hexRadius*(this.game.ringSize+5)*2 }
    @computed get boardHeight() { return this.hexRadius*(this.game.ringSize+5)*2 }
    @computed get boardCenterX() { return this.boardWidth/2 }
    @computed get boardCenterY() { return this.boardHeight/2 }

    @observable isMouseDown: boolean = false
    @observable isTargetTeleport: boolean = false
    @observable currentSelection: Cell[] = []
    @observable pathTarget: Hex

    @observable isTargetBarrier: boolean = false
    @observable barrierStart?: Cell

    @observable cursor: Cell

    timeCounter = 0
    prevTime?: number
    paused: boolean = false
    @action.bound frame(time: number) {
        const deltaTime = time - (this.prevTime||time)
        this.prevTime = time

        /*const frameInterval = 20
        this.timeCounter += deltaTime
        if (this.timeCounter > frameInterval && !this.paused) {
            this.game.frame()
            this.timeCounter -= frameInterval
        }*/

        requestAnimationFrame(this.frame)
    }

    @action.bound onMouseDown(hex: Hex) {
        this.isMouseDown = true
        const targetCell = this.game.hexGrid.get(hex)

        if (this.isTargetTeleport) {
            const cells = this.game.playerCell.circle(6)
            if (cells.indexOf(targetCell) !== -1) {
                this.game.playerLocation = targetCell.hex
                this.isTargetTeleport = false
                this.game.numTeleports -= 1
            }
        } else if (this.isTargetBarrier) {
            if (this.barrierStart === undefined)
                this.barrierStart = this.cursor
            else {
                this.game.placeBarrier(this.barrierStart, this.cursor)
                this.toggleTargetBarrier()
                this.game.endTurn()
            }
        } else {
            const path = this.game.pathBetween(this.game.playerCell, targetCell)
            if (path) {
                this.game.playerLocation = path[0].hex
                this.game.endTurn()
            }    
        }
    }

    @action.bound onMouseMove(hex: Hex) {
        const targetCell = this.game.hexGrid.get(hex)

        this.cursor = targetCell
        if (this.isTargetBarrier) {
//            this.barrierStart = targetCell
        }
    }

    @action.bound onMouseUp(hex: Hex) {
        this.isMouseDown = false
    }

    hexToPolygon(hex: Hex): string {
        const {boardCenterX, boardCenterY, hexRadius} = this
        const screenX = boardCenterX + hexRadius * Math.sqrt(3) * (hex.q + hex.r/2)
        const screenY = boardCenterY + hexRadius * 3/2 * hex.r
        return hexagonPoints(screenX, screenY, hexRadius).join(" ")
    }

    renderTerrain() {
        const {game} = this

        return game.cells.map(cell => {
            const hex = cell.hex
            const isSelected = this.currentSelection.indexOf(cell) !== -1
            const isPlayer = hex.equals(game.playerLocation)

            const points = this.hexToPolygon(hex)

            return <polygon onMouseDown={e => this.onMouseDown(hex)} onMouseMove={e => this.onMouseMove(hex)} onMouseUp={e => this.onMouseUp(hex)} points={points} fill={(game.hexGrid.get(hex) as Cell).color} stroke={"#000"} strokeWidth={this.hexRadius/8}/>
        })
    }

    renderPlayer() {
        const {game} = this
        const points = this.hexToPolygon(game.playerLocation)
        return <polygon points={points} fill="lightgreen"/>
    }

    renderExit() {
        const points = this.hexToPolygon(this.game.exitLocation)
        return <polygon points={points} fill="white" onMouseDown={e => this.onMouseDown(this.game.exitLocation)}/>
    }

    renderEnemies() {
        return this.game.enemies.map(enemy => {
            const points = this.hexToPolygon(enemy.hex)
            return <polygon points={points} fill="red"/>
        })
    }

    renderPath() {
        const {game} = this
        const path = this.pathTarget && game.pathBetween(game.hexGrid.get(game.playerLocation), game.hexGrid.get(this.pathTarget))

        if (path === undefined)
            return

        return path.map(cell => {
            const points = this.hexToPolygon(cell.hex)
            return <polygon points={points} fill="yellow"/>
        })
    }

    renderTargetTeleport() {
        const cells = this.game.playerCell.circle(6)

        return cells.map(cell => {
            const points = this.hexToPolygon(cell.hex)
            return <polygon points={points} fill="yellow" opacity={0.5} onMouseDown={e => this.onMouseDown(cell.hex)}/>
        })
    }

    renderEndState() {
        const {game} = this
        if (game.state == 'success') {
            return <div id="game" className="success">
                <h2>Success!</h2>
                <div id="abilities">
                    <button onClick={e => game.nextLevel()}>Continue</button>
                </div>
            </div>
        } else {
            return <div id="game" className="failure">
                <h2>You were captured...</h2>
                <div id="abilities">
                    <button onClick={e => game.nextLevel()}>Continue</button>
                </div>
            </div>
        }
    }

    renderTargetBarrier() {
        if (!this.cursor) return
        const barrierCells = this.barrierStart ? this.barrierStart.lineTo(this.cursor) : [this.cursor]
        return barrierCells.map(cell => {
            const points = this.hexToPolygon(cell.hex)
            const hex = cell.hex
            return <polygon points={points} fill="cyan" opacity={0.5} onMouseDown={e => this.onMouseDown(hex)} onMouseMove={e => this.onMouseMove(hex)} onMouseUp={e => this.onMouseUp(hex)}/>            
        })
    }

    @action.bound toggleTargetBarrier() {
        this.barrierStart = undefined
        this.isTargetBarrier = !this.isTargetBarrier
    }

    render() {
        const {props, boardWidth, boardHeight, boardCenterX, boardCenterY, hexRadius, game} = this

        window.game = game
        window.gameView = this

        if (game.state !== 'game') {
            return this.renderEndState()
        }

        return <div id="game">
            <h2>Floor {game.level}</h2>
            <svg width={boardWidth} height={boardHeight}>
                {this.renderTerrain()}
                {this.renderPlayer()}
                {this.renderExit()}
                {this.renderEnemies()}
                {this.isTargetTeleport && this.renderTargetTeleport()}
                {this.isTargetBarrier && this.renderTargetBarrier()}
            </svg>
            <div id="abilities">
                <button onClick={e => this.toggleTargetBarrier() }>Barrier</button>
                <button onClick={e => this.isTargetTeleport = !this.isTargetTeleport} disabled={game.numTeleports == 0}>Teleport x{game.numTeleports}</button>
            </div>
        </div>
    }
}

window.homepageStart = function() {
    function render() {
        ReactDOM.render(<GameView width={window.innerWidth} height={window.innerHeight} />, document.querySelector("main"))
    }

    window.onresize = render
    render()
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <main> 
            <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
        </main>
	}
}
