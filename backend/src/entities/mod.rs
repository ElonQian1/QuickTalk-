//! Sea-ORM Entity definitions for the customer service system

pub mod users;
pub mod shops;
pub mod customers;
pub mod sessions;
pub mod messages;
pub mod shop_staffs;
pub mod unread_counts;
pub mod online_status;

pub use users::Entity as Users;
pub use shops::Entity as Shops;
pub use customers::Entity as Customers;
pub use sessions::Entity as Sessions;
pub use messages::Entity as Messages;
pub use shop_staffs::Entity as ShopStaffs;
pub use unread_counts::Entity as UnreadCounts;
pub use online_status::Entity as OnlineStatus;

// Re-export prelude for convenience
pub mod prelude {
    pub use super::users::Entity as Users;
    pub use super::shops::Entity as Shops;
    pub use super::customers::Entity as Customers;
    pub use super::sessions::Entity as Sessions;
    pub use super::messages::Entity as Messages;
    pub use super::shop_staffs::Entity as ShopStaffs;
    pub use super::unread_counts::Entity as UnreadCounts;
    pub use super::online_status::Entity as OnlineStatus;
}
