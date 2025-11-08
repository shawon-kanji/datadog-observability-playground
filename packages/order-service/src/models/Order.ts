/**
 * Order model for MongoDB
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  merchantId?: string;
  merchantName?: string;
}

export interface IOrder extends Document {
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItem>({
  productId: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  imageUrl: {
    type: String,
  },
  merchantId: {
    type: String,
  },
  merchantName: {
    type: String,
  },
}, { _id: false });

const orderSchema = new Schema<IOrder>(
  {
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: {
        validator: (items: OrderItem[]) => items && items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
      required: true,
    },
    shippingAddress: {
      type: String,
      required: [true, 'Shipping address is required'],
    },
    paymentMethod: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'items.merchantId': 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
