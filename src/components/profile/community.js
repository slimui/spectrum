// @flow
import React from 'react';
import Card from '../card';
//$FlowFixMe
import compose from 'recompose/compose';
//$FlowFixMe
import pure from 'recompose/pure';
//$FlowFixMe
import { Link } from 'react-router-dom';
//$FlowFixMe
import { connect } from 'react-redux';

import { toggleCommunityMembershipMutation } from '../../api/community';
import { addToastWithTimeout } from '../../actions/toasts';
import { addProtocolToString } from '../../helpers/utils';
import type { ProfileSizeProps } from './index';
import { MetaData } from './metaData';
import { displayLoadingCard } from '../loading';
import Icon from '../icons';
import {
  ProfileHeader,
  ProfileAvatar,
  ProfileHeaderLink,
  ProfileHeaderMeta,
  ProfileHeaderAction,
  Title,
  Description,
  Actions,
  ActionOutline,
  ExtLink,
} from './style';

type CommunityProps = {
  id: string,
  name: string,
  slug: string,
  isMember: boolean,
  website: string,
  profilePhoto: string,
  metaData: {
    channels: number,
    members: number,
  },
  communityPermissions: {
    isOwner: boolean,
    isMember: boolean,
    isModerator: boolean,
    isBlocked: boolean,
  },
};

const CommunityWithData = ({
  data: { community },
  profileSize,
  toggleCommunityMembership,
  data,
  dispatch,
  currentUser,
}: {
  data: { community: CommunityProps },
  profileSize: ProfileSizeProps,
  toggleCommunityMembership: Function,
  dispatch: Function,
  currentUser: Object,
}): React$Element<any> => {
  const componentSize = profileSize || 'mini';

  const toggleMembership = communityId => {
    toggleCommunityMembership({ communityId })
      .then(({ data: { toggleCommunityMembership } }) => {
        const str = toggleCommunityMembership.communityPermissions.isMember
          ? `Joined ${toggleCommunityMembership.name}!`
          : `Left ${toggleCommunityMembership.name}.`;

        const type = toggleCommunityMembership.communityPermissions.isMember
          ? 'success'
          : 'neutral';
        dispatch(addToastWithTimeout(type, str));
      })
      .catch(err => {
        dispatch(addToastWithTimeout('error', err.message));
      });
  };

  if (!community) {
    return (
      <Card>
        <ProfileHeader justifyContent={'flex-start'} alignItems={'center'}>
          <ProfileHeaderMeta direction={'column'} justifyContent={'center'}>
            <Title>This community doesn't exist yet.</Title>
          </ProfileHeaderMeta>
        </ProfileHeader>
        <Description>Want to make it?</Description>
        <Actions>
          <ActionOutline>Create</ActionOutline>
        </Actions>
      </Card>
    );
  }

  return (
    <Card>
      <ProfileHeader>
        <ProfileAvatar src={community.profilePhoto} />
        <ProfileHeaderLink to={`/${community.slug}`}>
          <ProfileHeaderMeta>
            <Title>{community.name}</Title>
          </ProfileHeaderMeta>
        </ProfileHeaderLink>
        {currentUser &&
          !community.communityPermissions.isOwner &&
          <ProfileHeaderAction
            glyph={
              community.communityPermissions.isMember ? 'minus' : 'plus-fill'
            }
            color={
              community.communityPermissions.isMember
                ? 'text.placeholder'
                : 'brand.alt'
            }
            hoverColor={
              community.communityPermissions.isMember
                ? 'warn.default'
                : 'brand.alt'
            }
            tipText={
              community.communityPermissions.isMember
                ? `Leave community`
                : 'Join community'
            }
            tipLocation="top-left"
            onClick={() => toggleMembership(community.id)}
          />}
        {currentUser &&
          community.communityPermissions.isOwner &&
          <Link to={`/${community.slug}/settings`}>
            <ProfileHeaderAction
              glyph="settings"
              tipText="Edit community"
              tipLocation="top-left"
            />
          </Link>}

      </ProfileHeader>

      {componentSize !== 'mini' &&
        componentSize !== 'small' &&
        <Description>
          <p>{community.description}</p>
          {community.website &&
            <ExtLink>
              <Icon glyph="link" size={24} />
              <a href={addProtocolToString(community.website)}>
                {community.website}
              </a>
            </ExtLink>}
        </Description>}

      {(componentSize === 'large' || componentSize === 'full') &&
        <MetaData data={community.metaData} />}
    </Card>
  );
};

const Community = compose(
  toggleCommunityMembershipMutation,
  displayLoadingCard,
  pure
)(CommunityWithData);

const mapStateToProps = state => ({
  currentUser: state.users.currentUser,
});
export default connect(mapStateToProps)(Community);