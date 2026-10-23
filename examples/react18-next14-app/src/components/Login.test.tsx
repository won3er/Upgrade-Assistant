import { act } from 'react-dom/test-utils';
import { Login } from './Login';

// Illustrative only — the example app has no test runner configured.
export async function runLoginSmokeTest(render: (el: unknown) => void) {
  await act(async () => {
    render(<Login title="Test" />);
  });
}
