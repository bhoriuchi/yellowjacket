
export class YellowJacketServer {
  constructor (backend) {
    this.backend = backend
  }

}

export default function (backend) {
  return new YellowJacketServer()
}