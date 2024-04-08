import neo4j, { Driver, QueryResult, RecordShape } from 'neo4j-driver'

interface Node {
  [key: string]: any
}

class Neo4jQueryBuilder {
  private driver?: Driver
  private uri: string
  private username: string
  private password: string

  constructor(uri: string, username: string, password: string, loose = false) {
    this.uri = uri
    this.username = username
    this.password = password

    if (!loose) {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
    }
  }

  private query: string = ''
  private parameters: Node = {}

  private clearQuery() {
    this.query = ''
    this.parameters = {}
  }

  private addQueryPart(queryPart: string, parameters: Node = {}) {
    this.query += queryPart
    this.parameters = { ...this.parameters, ...parameters }
  }

  select(...fields: string[]): Neo4jQueryBuilder {
    this.clearQuery()
    const fieldsString = fields.length ? fields.join(', ') : '*'
    this.addQueryPart(`RETURN ${fieldsString}`)
    return this
  }

  from(label: string): Neo4jQueryBuilder {
    this.addQueryPart(`MATCH (n:${label})`)
    return this
  }

  where(condition: string, parameters: Node = {}): Neo4jQueryBuilder {
    this.addQueryPart(`WHERE ${condition}`, parameters)
    return this
  }

  forEach(
    iterationVariable: string,
    listVariable: string,
    queryBuilder: (builder: Neo4jQueryBuilder) => Neo4jQueryBuilder,
    parameters: Node = {}
  ): Neo4jQueryBuilder {
    const subBuilder = new Neo4jQueryBuilder(
      this.uri,
      this.username,
      this.password,
      true
    )
    const builtQuery = queryBuilder(subBuilder).build()
    const forEachQuery = `FOREACH (${iterationVariable} IN ${listVariable} | ${builtQuery})`
    this.addQueryPart(forEachQuery, parameters)
    return this
  }

  build(): { query: string; parameters: Node } {
    return { query: this.query, parameters: this.parameters }
  }

  async execute(): Promise<Node[]> {
    if (!this.driver) {
      throw new Error('Failed to execute due to driver initialization error')
    }

    const session = this.driver.session()
    const result: QueryResult<RecordShape> = await session.run(
      this.query,
      this.parameters
    )

    this.clearQuery()
    session.close()

    return result.records.map((record) => record.toObject().n.properties)
  }

  async close(): Promise<void> {
    if (!this.driver) {
      throw new Error('Failed to execute due to driver initialization error')
    }

    await this.driver.close()
  }
}

export default Neo4jQueryBuilder
