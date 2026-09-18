import { Component } from 'react'
import type { ReactNode } from 'react'

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <section className="page">
        <p className="error-notice" role="alert">This view could not be displayed. Please try again or choose another page.</p>
        <button className="refresh-button" type="button" onClick={() => this.setState({ failed: false })}>Try again</button>
      </section>
    }
    return this.props.children
  }
}
