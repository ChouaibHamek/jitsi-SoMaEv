// @flow

import { connect } from 'react-redux';

import {
    AUDIO_MUTE,
    createToolbarEvent,
    sendAnalytics
} from '../../../analytics';
import { translate } from '../../../base/i18n';
import {
    MEDIA_TYPE,
    setAudioMuted
} from '../../../base/media';
import { isLocalTrackMuted } from '../../../base/tracks';

import AbstractAudioMuteButton from './AbstractAudioMuteButton';
import type { Props as AbstractButtonProps } from './AbstractButton';

type Props = AbstractButtonProps & {

    /**
     * Whether audio is currently muted or not.
     */
    _audioMuted: boolean,

    /**
     * The redux {@code dispatch} function.
     */
    dispatch: Function
}

/**
 * Component that renders a toolbar button for toggling audio mute.
 *
 * @extends AbstractAudioMuteButton
 */
class AudioMuteButton extends AbstractAudioMuteButton<Props, *> {
    label = 'toolbar.mute';
    tooltip = 'toolbar.mute';

    /**
     * Indicates if this button should be disabled or not.
     *
     * @override
     * @private
     * @returns {boolean}
     */
    _isDisabled() {
        return false;
    }

    /**
     * Indicates if audio is currently muted ot nor.
     *
     * @override
     * @private
     * @returns {boolean}
     */
    _isAudioMuted() {
        return this.props._audioMuted;
    }

    /**
     * Changes the muted state.
     *
     * @param {boolean} audioMuted - Whether audio should be muted or not.
     * @private
     * @returns {void}
     */
    _setAudioMuted(audioMuted: boolean) {
        sendAnalytics(createToolbarEvent(AUDIO_MUTE, { enable: audioMuted }));
        this.props.dispatch(setAudioMuted(audioMuted));
    }

}

/**
 * Maps (parts of) the redux state to the associated props for the
 * {@code AudioMuteButton} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _audioMuted: boolean
 * }}
 */
function _mapStateToProps(state): Object {
    const tracks = state['features/base/tracks'];

    return {
        _audioMuted: isLocalTrackMuted(tracks, MEDIA_TYPE.AUDIO)
    };
}

export default translate(connect(_mapStateToProps)(AudioMuteButton));
