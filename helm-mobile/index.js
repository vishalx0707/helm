import { registerRootComponent } from 'expo';
import App from './App';

// HELM Mobile entry point. registerRootComponent wires App as the root and calls
// AppRegistry.registerComponent for both native and Expo Go.
registerRootComponent(App);
