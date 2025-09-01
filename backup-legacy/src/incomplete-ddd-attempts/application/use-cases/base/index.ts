/**
 * 用例基类统一导出
 */

// UseCase相关
export {
  UseCase,
  CommandUseCase,
  VoidCommandUseCase,
  IUseCaseRequest,
  IUseCaseResponse,
  IVoidResponse
} from './UseCase'

// Query相关
export {
  Query,
  PaginatedQuery,
  SingleQuery,
  AggregateQuery,
  IQueryRequest,
  IQueryResponse,
  IPaginationRequest,
  IPaginationResponse,
  ISortRequest,
  IFilterRequest,
  IPaginatedQueryRequest,
  IPaginatedQueryResponse,
  ISingleQueryRequest,
  ISingleQueryResponse,
  IAggregateQueryRequest,
  IAggregateQueryResponse
} from './Query'