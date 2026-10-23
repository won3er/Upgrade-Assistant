import React from 'react';
import ReactDOM from 'react-dom';
import { Login } from '../components/Login';

const container = document.getElementById('root')!;

export function mount() {
  ReactDOM.render(<Login title="Legacy mount" />, container);
}

export function rehydrate() {
  ReactDOM.hydrate(<Login title="SSR" />, container);
}

export function teardown() {
  ReactDOM.unmountComponentAtNode(container);
}

export class OldForm extends React.Component {
  componentDidMount() {
    // Legacy string-ref access:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (this.refs as any).nameInput;
    input?.focus?.();
  }

  render() {
    return <input ref="nameInput" placeholder="name" />;
  }
}
