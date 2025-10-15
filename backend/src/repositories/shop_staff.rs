//! ShopStaff Repository - 店铺员工数据访问层

use anyhow::Result;
use sea_orm::*;
use crate::entities::{shop_staffs, users, shops, prelude::*};

pub struct ShopStaffRepository;

impl ShopStaffRepository {
    /// 添加员工到店铺
    pub async fn add_staff(
        db: &DatabaseConnection,
        shop_id: i32,
        user_id: i32,
        role: String,
    ) -> Result<shop_staffs::Model> {
        let staff = shop_staffs::ActiveModel {
            shop_id: Set(shop_id),
            user_id: Set(user_id),
            role: Set(role),
            is_active: Set(true),
            joined_at: Set(chrono::Utc::now().naive_utc()),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };
        
        Ok(staff.insert(db).await?)
    }
    
    /// 获取店铺的所有员工
    pub async fn find_by_shop(db: &DatabaseConnection, shop_id: i32) -> Result<Vec<shop_staffs::Model>> {
        let staffs = ShopStaffs::find()
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .all(db)
            .await?;
        Ok(staffs)
    }
    
    /// 检查用户是否是店铺员工
    pub async fn is_staff_of_shop(db: &DatabaseConnection, user_id: i32, shop_id: i32) -> Result<bool> {
        let count = ShopStaffs::find()
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .count(db)
            .await?;
        
        Ok(count > 0)
    }
    
    /// 移除员工
    pub async fn remove_staff(db: &DatabaseConnection, shop_id: i32, user_id: i32) -> Result<()> {
        let staff = ShopStaffs::find()
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Staff not found"))?;
        
        let mut staff: shop_staffs::ActiveModel = staff.into();
        staff.is_active = Set(false);
        staff.updated_at = Set(chrono::Utc::now().naive_utc());
        staff.update(db).await?;
        
        Ok(())
    }
    
    /// 列出店铺的所有员工（包括用户信息）
    /// 
    /// 对应 database.rs 中的 list_shop_staff 方法
    /// 返回 (用户信息, 角色) 元组列表
    pub async fn list_shop_staff(
        db: &DatabaseConnection,
        shop_id: i64,
    ) -> Result<Vec<(users::Model, String)>> {
        let mut result = Vec::new();
        
        // 1. 获取店主信息
        if let Some(shop) = Shops::find_by_id(shop_id as i32).one(db).await? {
            if let Some(owner_id) = shop.owner_id {
                if let Some(owner) = Users::find_by_id(owner_id).one(db).await? {
                    result.push((owner, "owner".to_string()));
                }
            }
        }
        
        // 2. 获取员工信息（使用 JOIN）
        let staffs = ShopStaffs::find()
            .filter(shop_staffs::Column::ShopId.eq(shop_id as i32))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .find_also_related(Users)
            .all(db)
            .await?;
        
        for (staff, user_opt) in staffs {
            if let Some(user) = user_opt {
                result.push((user, staff.role));
            }
        }
        
        Ok(result)
    }
    
    /// 根据用户名添加员工
    /// 
    /// 对应 database.rs 中的 add_shop_staff_by_username 方法
    pub async fn add_staff_by_username(
        db: &DatabaseConnection,
        shop_id: i32,
        username: &str,
        role: Option<&str>,
    ) -> Result<shop_staffs::Model> {
        // 1. 查找用户
        let user = Users::find()
            .filter(users::Column::Username.eq(username))
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("user_not_found"))?;
        
        // 2. 检查是否是店主
        if let Some(shop) = Shops::find_by_id(shop_id).one(db).await? {
            if let Some(owner_id) = shop.owner_id {
                if owner_id == user.id {
                    anyhow::bail!("user_is_owner");
                }
            }
        } else {
            anyhow::bail!("shop_not_found");
        }
        
        // 3. 检查是否已是员工
        let exists = ShopStaffs::find()
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::UserId.eq(user.id))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .one(db)
            .await?;
        
        if exists.is_some() {
            anyhow::bail!("already_member");
        }
        
        // 4. 添加员工
        let the_role = role.unwrap_or("staff");
        let staff = shop_staffs::ActiveModel {
            shop_id: Set(shop_id),
            user_id: Set(user.id),
            role: Set(the_role.to_string()),
            is_active: Set(true),
            joined_at: Set(chrono::Utc::now().naive_utc()),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };
        
        Ok(staff.insert(db).await?)
    }
    
    /// 检查用户是否是店铺所有者
    /// 
    /// 对应 database.rs 中的 is_shop_owner 方法
    pub async fn is_shop_owner(db: &DatabaseConnection, shop_id: i64, user_id: i64) -> Result<bool> {
        let shop = Shops::find_by_id(shop_id as i32).one(db).await?;
        
        match shop {
            Some(s) => {
                match s.owner_id {
                    Some(owner_id) => Ok(owner_id == user_id as i32),
                    None => Ok(false),
                }
            },
            None => Ok(false),
        }
    }
    
    /// 检查用户是否是店铺成员（所有者或员工）
    /// 
    /// 对应 database.rs 中的 is_shop_member 方法
    pub async fn is_shop_member(db: &DatabaseConnection, shop_id: i64, user_id: i64) -> Result<bool> {
        // 先检查是否是所有者
        if Self::is_shop_owner(db, shop_id, user_id).await? {
            return Ok(true);
        }
        
        // 再检查是否是员工
        Self::is_staff_of_shop(db, user_id as i32, shop_id as i32).await
    }
    
    /// 永久删除员工（硬删除）
    pub async fn hard_delete(db: &DatabaseConnection, shop_id: i32, user_id: i32) -> Result<u64> {
        let result = ShopStaffs::delete_many()
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .exec(db)
            .await?;
        
        Ok(result.rows_affected)
    }
    
    /// 更新员工角色
    pub async fn update_role(
        db: &DatabaseConnection,
        shop_id: i32,
        user_id: i32,
        new_role: String,
    ) -> Result<()> {
        let staff = ShopStaffs::find()
            .filter(shop_staffs::Column::ShopId.eq(shop_id))
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Staff not found"))?;
        
        let mut staff: shop_staffs::ActiveModel = staff.into();
        staff.role = Set(new_role);
        staff.updated_at = Set(chrono::Utc::now().naive_utc());
        staff.update(db).await?;
        
        Ok(())
    }
    
    /// 获取用户作为员工的所有店铺
    pub async fn find_shops_by_user(db: &DatabaseConnection, user_id: i32) -> Result<Vec<shops::Model>> {
        let shop_ids: Vec<i32> = ShopStaffs::find()
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .all(db)
            .await?
            .into_iter()
            .map(|s| s.shop_id)
            .collect();
        
        if shop_ids.is_empty() {
            return Ok(vec![]);
        }
        
        let shops = Shops::find()
            .filter(shops::Column::Id.is_in(shop_ids))
            .filter(shops::Column::IsActive.eq(true))
            .all(db)
            .await?;
        
        Ok(shops)
    }



    /// 通过用户名添加员工
    pub async fn add_shop_staff_by_username(
        db: &DatabaseConnection,
        shop_id: i64,
        username: &str,
        role: Option<&str>,
    ) -> Result<()> {
        // 查找用户
        let user = Users::find()
            .filter(users::Column::Username.eq(username))
            .one(db)
            .await?;

        if let Some(user) = user {
            let role = role.unwrap_or("staff").to_string();
            Self::add_staff(db, shop_id as i32, user.id, role).await?;
        }

        Ok(())
    }

    /// 移除员工
    pub async fn remove_shop_staff(
        db: &DatabaseConnection,
        shop_id: i64,
        user_id: i64,
    ) -> Result<u64> {
        let result = ShopStaffs::delete_many()
            .filter(shop_staffs::Column::ShopId.eq(shop_id as i32))
            .filter(shop_staffs::Column::UserId.eq(user_id as i32))
            .exec(db)
            .await?;
        
        Ok(result.rows_affected)
    }
}
