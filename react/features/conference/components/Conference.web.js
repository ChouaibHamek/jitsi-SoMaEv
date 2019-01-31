// @flow

import _ from 'lodash';
import React, { Component } from 'react';
import { connect as reactReduxConnect } from 'react-redux';
import { getParticipants, kickParticipant } from '../../base/participants';
import { setFilmstripVisible } from '../../filmstrip';

import VideoLayout from '../../../../modules/UI/videolayout/VideoLayout';

import { obtainConfig } from '../../base/config';
import { connect, disconnect } from '../../base/connection';
import { translate } from '../../base/i18n';
import { Chat } from '../../chat';
import { Filmstrip } from '../../filmstrip';
import { CalleeInfoContainer } from '../../invite';
import { LargeVideo } from '../../large-video';
import { NotificationsContainer } from '../../notifications';
import {
    LAYOUTS,
    getCurrentLayout,
    shouldDisplayTileView
} from '../../video-layout';

import { default as Notice } from './Notice';
import {
    Toolbox,
    fullScreenChanged,
    setToolboxAlwaysVisible,
    showToolbox
} from '../../toolbox';

import { maybeShowSuboptimalExperienceNotification } from '../functions';

declare var APP: Object;
declare var config: Object;
declare var interfaceConfig: Object;

const logger = require('jitsi-meet-logger').getLogger(__filename);

/**
 * DOM events for when full screen mode has changed. Different browsers need
 * different vendor prefixes.
 *
 * @private
 * @type {Array<string>}
 */
const FULL_SCREEN_EVENTS = [
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'fullscreenchange'
];

/**
 * The CSS class to apply to the root element of the conference so CSS can
 * modify the app layout.
 *
 * @private
 * @type {Object}
 */
const LAYOUT_CLASSNAMES = {
    [LAYOUTS.HORIZONTAL_FILMSTRIP_VIEW]: 'horizontal-filmstrip',
    [LAYOUTS.TILE_VIEW]: 'tile-view',
    [LAYOUTS.VERTICAL_FILMSTRIP_VIEW]: 'vertical-filmstrip'
};

/**
 * The type of the React {@code Component} props of {@link Conference}.
 */
type Props = {

    /**
     * Whether the local participant is recording the conference.
     */
    _iAmRecorder: boolean,

    /**
     * The CSS class to apply to the root of {@link Conference} to modify the
     * application layout.
     */
    _layoutClassName: string,

    /**
     * Conference room name.
     */
    _room: string,

    /**
     * Whether or not the current UI layout should be in tile view.
     */
    _shouldDisplayTileView: boolean,

    dispatch: Function,
    t: Function
}

/**
 * The conference page of the Web application.
 */
class Conference extends Component<Props> {
    _onFullScreenChange: Function;
    _onShowToolbar: Function;
    _originalOnShowToolbar: Function;

    state = {
      showWaitingView: true,
      loadingDisplayedMessage: "Loading...",
      rolesLoaded: false,
      showNewUserPortal: false,
      newUsers: [],
    };
    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);

        // Throttle and bind this component's mousemove handler to prevent it
        // from firing too often.
        this._originalOnShowToolbar = this._onShowToolbar;
        this._onShowToolbar = _.throttle(
            () => this._originalOnShowToolbar(),
            100,
            {
                leading: true,
                trailing: false
            });

        // Bind event handler so it is only bound once for every instance.
        this._onFullScreenChange = this._onFullScreenChange.bind(this);
    }

    /**
     * Start the connection and get the UI ready for the conference.
     *
     * @inheritdoc
     */
    componentDidMount() {
        const { configLocation } = config;
        // console.log("###############################  TURNING OFF THE FILMSTRIP IN A FEW");
        // setTimeout(() => this.props.dispatch(setFilmstripVisible(false)), 3000);
        // console.log("###############################  TURNING ON THE FILMSTRIP IN A FEW");
        // setTimeout(() => this.props.dispatch(setFilmstripVisible(true)), 10000);

        if (configLocation) {
            obtainConfig(configLocation, this.props._room)
                .then(() => {
                    const now = window.performance.now();

                    APP.connectionTimes['configuration.fetched'] = now;
                    logger.log('(TIME) configuration fetched:\t', now);

                    this._start();
                })
                .catch(err => {
                    logger.log(err);

                    // Show obtain config error.
                    APP.UI.messageHandler.showError({
                        descriptionKey: 'dialog.connectError',
                        titleKey: 'connection.CONNFAIL'
                    });
                });
        } else {
            this._start();
        }
    }

    /**
     * Calls into legacy UI to update the application layout, if necessary.
     *
     * @inheritdoc
     * returns {void}
     */
    componentDidUpdate(prevProps) {
        if (this.props._shouldDisplayTileView
            === prevProps._shouldDisplayTileView) {
            return;
        }

        // TODO: For now VideoLayout is being called as LargeVideo and Filmstrip
        // sizing logic is still handled outside of React. Once all components
        // are in react they should calculate size on their own as much as
        // possible and pass down sizings.
        VideoLayout.refreshLayout();
    }

    componentWillReceiveProps(nextProps) {
      if (nextProps._participants) {
        // console.log("+++++++++++++++++++++++++++++++++++++++++");
        // console.log("+++++++++++++ _PARTICIPANTS: ", nextProps._participants);
        // console.log("+++++++++++++++++++++++++++++++++++++++++");
        for (var i = 0; i < nextProps._participants.length; i++) {
          if (nextProps._participants[i].role === "moderator") {
            this.setState({ rolesLoaded: true });
          }
          if (nextProps._participants[i].local) {
            if (!this.state.localUserID || this.state.localUserID === "local") {
              // console.log("+++++++++++++++++++++++++++++++++++++++++");
              // console.log("+++++++++++++ UPDATING LOCAL USER: ", nextProps._participants[i]);
              // console.log("+++++++++++++++++++++++++++++++++++++++++");
              this.setState({ localUserID: nextProps._participants[i].id });
            }
            if (nextProps._participants[i].role === "moderator") {
              this.setState({ showWaitingView: false, localUserIsModerator: true });
            } else if (this.state.rolesLoaded) {
              this.setState({ loadingDisplayedMessage: "Waiting for moderator to accept..." });
            }
          }
        }
      }
      if (nextProps._participants.length > this.props._participants.length && this.state.localUserIsModerator) {
        console.log("+++++++++++++++++++++++++++++++++++++++++");
        console.log("+++++++++++++ NEW USER JOINED: ", nextProps._participants);
        console.log("+++++++++++++++++++++++++++++++++++++++++");
        // this.props.dispatch(setFilmstripVisible(false));
        this.setState({ showNewUserPortal: true });
      }
      if (!this.state.localUserIsModerator) {
        // console.log("+++++++++++++++++++++++++++++++++++++++++");
        // console.log("+++++++++++++ WILL RECEIVE PROPS: ", {
        //     localUserID: this.state.localUserID,
        //     acceptedUsers: nextProps._acceptedUsers,
        //     localUserIsModerator: this.state.localUserIsModerator,
        //   });
        // console.log("+++++++++++++++++++++++++++++++++++++++++");
      }
      if (this.state.localUserID && nextProps._acceptedUsers && !this.state.localUserIsModerator) {
        for (var i = 0; i < nextProps._acceptedUsers.length; i++) {;
          if (nextProps._acceptedUsers[i] === this.state.localUserID) {
            this.setState({ showWaitingView: false });
          }
        }
      }
      const newUsersList = [];
      if (this.props._participants && this.props._acceptedUsers) {
        for (var i = 0; i < this.props._participants.length; i++) {
          if (this.props._participants[i].role !== "moderator") {
            var isAlreadyAccepted = false;
            for (var j = 0; j < this.props._acceptedUsers.length; j++) {
              if (this.props._acceptedUsers[j].id === this.props._participants[i].id) {
                isAlreadyAccepted = true;
                break;
              }
            }
            if (!isAlreadyAccepted) {
              newUsersList.push(this.props._participants[i]);
            }
          }
        }
        if (newUsersList.length === 0 && this.state.localUserIsModerator) {
          this.setState({ showNewUserPortal: false, newUsersList });
          // this.props.dispatch(setFilmstripVisible(true));
        }
        if (newUsersList.length > 0 && this.state.localUserIsModerator) {
          this.setState({ showNewUserPortal: true, newUsersList });
          // this.props.dispatch(setFilmstripVisible(false));
        }
      }
    }

    /**
     * Disconnect from the conference when component will be
     * unmounted.
     *
     * @inheritdoc
     */
    componentWillUnmount() {
        APP.UI.unregisterListeners();
        APP.UI.unbindEvents();

        FULL_SCREEN_EVENTS.forEach(name =>
            document.removeEventListener(name, this._onFullScreenChange));

        APP.conference.isJoined() && this.props.dispatch(disconnect());
    }

    acceptUser(userId) {
      APP.conference.acceptUser(userId);
    }

    renderWaitingUsersList() {
      const newUsersList = [];
      /// TODO: CHANGE THIS LOGIC INTO CYCLE METHOD, to avoid setstate in render
      if (this.state.newUsersList) {
        for (var i = 0; i < this.state.newUsersList.length; i++) {
          const userId = this.state.newUsersList[i].id;
          newUsersList.push(
            <li>
              <h2 style={{ display: "inline" }}>{this.state.newUsersList[i].name}</h2>
              <h2 style={{ display: "inline", margin: "0 20px" }}>{this.state.newUsersList[i].id}</h2>
              <button
                style={{ margin: "0 20px", backgroundColor: "green", display: "inline" }}
                onClick={() => this.acceptUser(userId)}
                >ACCEPT</button>
              <button
                style={{ backgroundColor: "red", display: "inline" }}
                onClick={() => this.props.dispatch(kickParticipant(userId))}
                >REJECT</button>
            </li>
            );
        }
      }
      return newUsersList;
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const {
            VIDEO_QUALITY_LABEL_DISABLED,

            // XXX The character casing of the name filmStripOnly utilized by
            // interfaceConfig is obsolete but legacy support is required.
            filmStripOnly: filmstripOnly
        } = interfaceConfig;
        const hideVideoQualityLabel
            = filmstripOnly
                || VIDEO_QUALITY_LABEL_DISABLED
                || this.props._iAmRecorder;

        console.log("+++++++++++++++++++++++++++++++++++++++++");
        console.log("+++++++++++++ _PARTICIPANTS: ", this.props._participants);
        console.log("+++++++++++++++++++++++++++++++++++++++++");

        return (
          <div
              className = { this.props._layoutClassName }
              id = 'videoconference_page'
              onMouseMove = { this._onShowToolbar }>
              <Notice />
              <div id = 'videospace'>
                  <LargeVideo hideVideoQualityLabel = { hideVideoQualityLabel } />
                  <Filmstrip filmstripOnly = { filmstripOnly } />
              </div>

              { filmstripOnly || <Toolbox /> }
              { filmstripOnly || <Chat /> }

              <NotificationsContainer />

              <CalleeInfoContainer />
              { this.state.showWaitingView && <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    zIndex: "999",
                    backgroundColor: "rgba(0, 0, 0, 1)",
                    textAlign: "center",
                    color: "white",
                    display: "table",
                  }}>
                  <h1 style={{ color: "rgb(255, 255, 255)", verticalAlign: "middle", marginRight: "auto", marginLeft: "auto", display: "table-cell" }}>{this.state.loadingDisplayedMessage}</h1>
                  {/*<button onClick={this.sendDataToUser.bind(this)}>SEND DATA</button>*/}
                </div>
              }
              { this.state.showNewUserPortal && <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    zIndex: "999",
                    backgroundColor: "rgba(0, 0, 0, 0.9)",
                    textAlign: "center",
                    color: "white",
                    display: "table",
                  }}>
                  <h1 style={{ color: "rgb(255, 255, 255)", verticalAlign: "middle", marginRight: "auto", marginLeft: "auto" }}>Users waiting to join the call:</h1>
                  <ul>{this.renderWaitingUsersList()}</ul>
                </div>
              }
          </div>
        );
    }

    /**
     * Updates the Redux state when full screen mode has been enabled or
     * disabled.
     *
     * @private
     * @returns {void}
     */
    _onFullScreenChange() {
        this.props.dispatch(fullScreenChanged(APP.UI.isFullScreen()));
    }

    /**
     * Displays the toolbar.
     *
     * @private
     * @returns {void}
     */
    _onShowToolbar() {
        this.props.dispatch(showToolbox());
    }

    /**
     * Until we don't rewrite UI using react components
     * we use UI.start from old app. Also method translates
     * component right after it has been mounted.
     *
     * @inheritdoc
     */
    _start() {
        APP.UI.start();

        APP.UI.registerListeners();
        APP.UI.bindEvents();

        FULL_SCREEN_EVENTS.forEach(name =>
            document.addEventListener(name, this._onFullScreenChange));

        const { dispatch, t } = this.props;

        dispatch(connect());

        maybeShowSuboptimalExperienceNotification(dispatch, t);

        interfaceConfig.filmStripOnly
            && dispatch(setToolboxAlwaysVisible(true));
    }
}

/**
 * Maps (parts of) the Redux state to the associated props for the
 * {@code Conference} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _iAmRecorder: boolean,
 *     _layoutClassName: string,
 *     _room: ?string,
 *     _shouldDisplayTileView: boolean
 * }}
 */
function _mapStateToProps(state) {
    const currentLayout = getCurrentLayout(state);

    return {
        _iAmRecorder: state['features/base/config'].iAmRecorder,
        _layoutClassName: LAYOUT_CLASSNAMES[currentLayout],
        _room: state['features/base/conference'].room,
        _shouldDisplayTileView: shouldDisplayTileView(state),
        _participants: getParticipants(state),
        _acceptedUsers: state['features/base/conference'].acceptedUsers,
    };
}

export default reactReduxConnect(_mapStateToProps)(translate(Conference));
