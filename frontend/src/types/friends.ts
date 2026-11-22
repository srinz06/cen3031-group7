export type Friend = {
  id: string;
  name: string;
  email: string;
};

export type FriendRequest = {
  id: string;
  user: Friend;
};

export type FriendsData = {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};
