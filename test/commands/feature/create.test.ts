import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('feature:create', () => {
  it('runs feature:create cmd', async () => {
    const {stdout} = await runCommand('feature:create')
    expect(stdout).to.contain('hello world')
  })

  it('runs feature:create --name oclif', async () => {
    const {stdout} = await runCommand('feature:create --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
