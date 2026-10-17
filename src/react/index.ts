/** Local source-module entrypoint. No Studio root, persisted workspace or published package. The host session
 * (diagramcloud.host-session/1, diagramcloud.host-return/1) is explicit, read-only by default and never applies. */
export {DiagramCloudViewer} from './DiagramCloudViewer';
export type {DiagramCloudViewerProps} from './DiagramCloudViewer';
export {REACT_VIEWER_API_VERSION} from './viewerBoundary';
export type {ViewerSelection,ViewerSelectionIntent,ViewerSourceIntent} from './viewerBoundary';
export {HOST_SESSION_FORMAT,HOST_RETURN_FORMAT,HOST_CAPABILITIES,VIEWER_CAPABILITIES,NOT_PROVIDED,RETURN_REFUSAL_TEXT,SESSION_REFUSED,negotiateCapabilities,createReturnIntent,createReturnGuard,returnFileText,parseReturnFile} from './hostSession';
export type {HostCapability,HostSessionOffer,HostSession,Negotiation,HostReturnIntent,HostReturnKind,ReturnBinding,ReturnGuard,ReturnRefusal,ReturnVerdict} from './hostSession';
